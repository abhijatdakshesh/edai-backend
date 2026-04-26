// Package api provides the HTTP layer for the voice service.
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/edai/voice/internal/exoml"
	"github.com/edai/voice/internal/orchestrator"
	"github.com/edai/voice/internal/telephony"
	"github.com/edai/voice/internal/tts"
	"github.com/edai/voice/internal/twiml"
)

// audioEntry holds a pre-generated TTS audio buffer.
type audioEntry struct {
	data      []byte
	expiresAt time.Time
}

// Server holds shared dependencies for all HTTP handlers.
type Server struct {
	Sessions    *orchestrator.SessionRegistry
	AIEngine    string
	Sarvam      *tts.SarvamClient
	Twilio      *telephony.TwilioClient
	WebhookBase string // e.g. https://your-tunnel.trycloudflare.com

	audioMu    sync.RWMutex
	audioStore map[string]*audioEntry // callID → WAV bytes
	prebuilt   map[string][]byte      // "lang:callType" → WAV bytes (generated at startup)
}

var allLangs = []string{"kn", "hi", "ta", "te", "en"}
var allCallTypes = []string{"ABSENT_CALL", "FEE_REMINDER", "WEEKLY_UPDATE", "ASSIGNMENT_MISS", "EXAM_REMINDER"}

func NewServer(
	sessions *orchestrator.SessionRegistry,
	aiEngine string,
	sarvam *tts.SarvamClient,
	twilio *telephony.TwilioClient,
	webhookBase string,
) *Server {
	s := &Server{
		Sessions:    sessions,
		AIEngine:    aiEngine,
		Sarvam:      sarvam,
		Twilio:      twilio,
		WebhookBase: webhookBase,
		audioStore:  make(map[string]*audioEntry),
		prebuilt:    make(map[string][]byte),
	}
	go s.runAudioGC()
	go s.pregenAllAudio()
	return s
}

// pregenAllAudio generates WAV for all lang×callType combos at startup.
func (s *Server) pregenAllAudio() {
	log.Println("[pregen] Starting pre-generation of all language audio...")
	for _, lang := range allLangs {
		for _, callType := range allCallTypes {
			key := lang + ":" + callType
			script := exoml.OpeningScript(lang, callType, "your child")
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			audio, err := s.Sarvam.Synthesise(ctx, script, lang, "anushka")
			cancel()
			if err != nil {
				log.Printf("[pregen] FAILED %s: %v", key, err)
				continue
			}
			s.audioMu.Lock()
			s.prebuilt[key] = audio
			s.audioMu.Unlock()
			log.Printf("[pregen] OK %s bytes=%d", key, len(audio))
		}
	}
	log.Println("[pregen] Done pre-generating all audio")
}

// runAudioGC removes expired audio entries every 5 minutes.
func (s *Server) runAudioGC() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		s.audioMu.Lock()
		for id, e := range s.audioStore {
			if time.Now().After(e.expiresAt) {
				delete(s.audioStore, id)
			}
		}
		s.audioMu.Unlock()
	}
}

func (s *Server) storeAudio(callID string, data []byte) {
	s.audioMu.Lock()
	s.audioStore[callID] = &audioEntry{data: data, expiresAt: time.Now().Add(10 * time.Minute)}
	s.audioMu.Unlock()
}

func (s *Server) getAudio(callID string) ([]byte, bool) {
	s.audioMu.RLock()
	defer s.audioMu.RUnlock()
	e, ok := s.audioStore[callID]
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.data, true
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/voice/calls/trigger", s.triggerCall)
	mux.HandleFunc("/voice/calls/", s.getCallStatus)
	mux.HandleFunc("/voice/webhook/twilio/answer", s.twilioAnswer)
	mux.HandleFunc("/voice/webhook/twilio/gather", s.twilioGather)
	mux.HandleFunc("/voice/webhook/twilio/status", s.twilioStatus)
	mux.HandleFunc("/voice/audio/", s.serveAudio)
	mux.HandleFunc("/health", s.health)
}

type triggerCallReq struct {
	StudentID      string                 `json:"studentId"`
	ParentID       string                 `json:"parentId"`
	ParentPhone    string                 `json:"parentPhone"`
	Language       string                 `json:"language"`
	CallType       string                 `json:"callType"`
	InstitutionID  string                 `json:"institutionId"`
	StudentContext map[string]interface{} `json:"studentContext"`
}

func (s *Server) triggerCall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req triggerCallReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if req.Language == "" {
		req.Language = "en"
	}
	if req.ParentPhone == "" {
		http.Error(w, "parentPhone required", http.StatusBadRequest)
		return
	}

	callID := uuid.New().String()
	sess := orchestrator.NewCallSession(callID, req.StudentID, req.ParentID, req.Language, req.CallType, req.InstitutionID, req.StudentContext)
	s.Sessions.Add(sess)

	// Pre-generate TTS audio so it's ready when Twilio answers.
	go func() {
		script := exoml.OpeningScript(sess.Language, sess.CallType, sess.StudentID)
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		audio, err := s.Sarvam.Synthesise(ctx, script, sess.Language, "anushka")
		if err != nil {
			log.Printf("[TTS] Sarvam failed callID=%s lang=%s: %v (will use Say fallback)", callID, sess.Language, err)
			return
		}
		s.storeAudio(callID, audio)
		log.Printf("[TTS] audio ready callID=%s lang=%s bytes=%d", callID, sess.Language, len(audio))
	}()

	// Place the outbound Twilio call.
	answerURL := fmt.Sprintf("%s/voice/webhook/twilio/answer?callId=%s", s.WebhookBase, callID)
	statusURL := fmt.Sprintf("%s/voice/webhook/twilio/status?callId=%s", s.WebhookBase, callID)

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		sid, err := s.Twilio.PlaceCallWithURL(ctx, req.ParentPhone, answerURL, statusURL)
		if err != nil {
			log.Printf("[Twilio] place call failed callID=%s: %v", callID, err)
			sess.TransitionTo(orchestrator.StateFailed)
			return
		}
		log.Printf("[Twilio] call placed callID=%s twilioSid=%s", callID, sid)
		sess.TransitionTo(orchestrator.StateRinging)
	}()

	log.Printf("[trigger] callID=%s student=%s lang=%s type=%s", callID, req.StudentID, req.Language, req.CallType)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"callId": callID,
		"status": "initiated",
	})
}

func (s *Server) getCallStatus(w http.ResponseWriter, r *http.Request) {
	callID := r.URL.Path[len("/voice/calls/"):]
	sess, ok := s.Sessions.Get(callID)
	if !ok {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"callId":   sess.CallID,
		"state":    sess.GetState(),
		"language": sess.Language,
		"callType": sess.CallType,
	})
}

// twilioAnswer is called by Twilio when the parent picks up.
// Returns TwiML: <Play> with Sarvam AI audio or <Say> fallback.
func (s *Server) twilioAnswer(w http.ResponseWriter, r *http.Request) {
	callID := r.URL.Query().Get("callId")
	log.Printf("[answer] callID=%s", callID)

	w.Header().Set("Content-Type", "text/xml")

	sess, ok := s.Sessions.Get(callID)
	if !ok {
		w.Write([]byte(twiml.SayAndHangup("Hello, this is an automated call from RVCE college. Please contact the main office.", "en-IN")))
		return
	}

	sess.TransitionTo(orchestrator.StateConnected)

	gatherURL := fmt.Sprintf("%s/voice/webhook/twilio/gather?callId=%s", s.WebhookBase, callID)

	// Use per-call audio if ready, otherwise fall back to prebuilt lang audio.
	audioKey := ""
	s.audioMu.RLock()
	if _, ok := s.audioStore[callID]; ok {
		audioKey = "call:" + callID
	} else if _, ok := s.prebuilt[sess.Language+":"+sess.CallType]; ok {
		audioKey = "prebuilt:" + sess.Language + ":" + sess.CallType
	}
	s.audioMu.RUnlock()

	if audioKey != "" {
		audioURL := fmt.Sprintf("%s/voice/audio/%s?key=%s", s.WebhookBase, callID, audioKey)
		w.Write([]byte(twiml.PlayAndGather(audioURL, gatherURL, 1, 8)))
		return
	}

	// No audio at all — fall back to Twilio built-in TTS.
	script := exoml.OpeningScript(sess.Language, sess.CallType, sess.StudentID)
	langCode := tts.LangCode(sess.Language)
	w.Write([]byte(twiml.SayAndGather(script, langCode, gatherURL, 1, 8)))
}

// twilioGather handles DTMF input. Press 9 to opt out of automated calls.
func (s *Server) twilioGather(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	callID := r.URL.Query().Get("callId")
	digits := r.FormValue("Digits")
	log.Printf("[gather] callID=%s digits=%s", callID, digits)

	if sess, ok := s.Sessions.Get(callID); ok {
		sess.PushDTMF(digits)
	}

	w.Header().Set("Content-Type", "text/xml")
	if digits == "9" {
		w.Write([]byte(twiml.SayAndHangup("You have been unsubscribed from automated calls. Goodbye.", "en-IN")))
		return
	}
	w.Write([]byte(twiml.Response("<Hangup/>")))
}

// twilioStatus handles call status callbacks from Twilio.
func (s *Server) twilioStatus(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	callID := r.URL.Query().Get("callId")
	status := r.FormValue("CallStatus")
	log.Printf("[status] callID=%s status=%s", callID, status)

	if sess, ok := s.Sessions.Get(callID); ok {
		switch status {
		case "ringing":
			sess.TransitionTo(orchestrator.StateRinging)
		case "in-progress":
			sess.TransitionTo(orchestrator.StateConnected)
		case "completed":
			sess.TransitionTo(orchestrator.StateCompleted)
		case "no-answer":
			sess.TransitionTo(orchestrator.StateNoAnswer)
		case "busy":
			sess.TransitionTo(orchestrator.StateBusy)
		case "failed":
			sess.TransitionTo(orchestrator.StateFailed)
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// serveAudio streams WAV audio. key param selects call-specific or prebuilt audio.
func (s *Server) serveAudio(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	var audio []byte

	s.audioMu.RLock()
	if key != "" && len(key) > 9 && key[:9] == "prebuilt:" {
		audio = s.prebuilt[key[9:]] // "lang:callType"
	} else {
		callID := r.URL.Path[len("/voice/audio/"):]
		if e, ok := s.audioStore[callID]; ok && time.Now().Before(e.expiresAt) {
			audio = e.data
		}
	}
	s.audioMu.RUnlock()

	if len(audio) == 0 {
		http.Error(w, "audio not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "audio/wav")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(audio)))
	w.Write(audio)
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "ok",
		"service":     "voice",
		"activeCalls": s.Sessions.ActiveCount(),
		"timestamp":   time.Now().UTC(),
	})
}
