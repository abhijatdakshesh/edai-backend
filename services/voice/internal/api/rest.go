// Package api provides the HTTP layer for the voice service.
package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/edai/voice/internal/exoml"
	"github.com/edai/voice/internal/orchestrator"
	"github.com/edai/voice/internal/tts"
)

// audioEntry holds a pre-generated TTS audio buffer.
type audioEntry struct {
	data      []byte
	expiresAt time.Time
}

// Server holds shared dependencies for all HTTP handlers.
type Server struct {
	Sessions   *orchestrator.SessionRegistry
	AIEngine   string
	Sarvam     *tts.SarvamClient
	PublicBase string // e.g. https://your-tunnel.trycloudflare.com

	audioMu    sync.RWMutex
	audioStore map[string]*audioEntry // callID → WAV bytes
}

func NewServer(sessions *orchestrator.SessionRegistry, aiEngine string, sarvam *tts.SarvamClient, publicBase string) *Server {
	s := &Server{
		Sessions:   sessions,
		AIEngine:   aiEngine,
		Sarvam:     sarvam,
		PublicBase: publicBase,
		audioStore: make(map[string]*audioEntry),
	}
	go s.runAudioGC()
	return s
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
	mux.HandleFunc("/voice/webhook/exotel", s.exotelWebhook)
	mux.HandleFunc("/voice/webhook/exotel/answer", s.exotelAnswer)
	mux.HandleFunc("/voice/webhook/exotel/dtmf", s.exotelDTMF)
	mux.HandleFunc("/voice/audio/", s.serveAudio)
	mux.HandleFunc("/health", s.health)
}

type triggerCallReq struct {
	StudentID      string                 `json:"studentId"`
	ParentID       string                 `json:"parentId"`
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

	callID := uuid.New().String()
	sess := orchestrator.NewCallSession(callID, req.StudentID, req.ParentID, req.Language, req.CallType, req.InstitutionID, req.StudentContext)
	s.Sessions.Add(sess)

	// Pre-generate TTS audio in background so it's ready when Exotel answers
	go func() {
		script := exoml.OpeningScript(sess.Language, sess.CallType, sess.StudentID)
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		audio, err := s.Sarvam.Synthesise(ctx, script, sess.Language, "meera")
		if err != nil {
			log.Printf("[TTS] Sarvam failed for callID=%s lang=%s: %v (will use Say fallback)", callID, sess.Language, err)
			return
		}
		s.storeAudio(callID, audio)
		log.Printf("[TTS] Sarvam audio ready for callID=%s lang=%s bytes=%d", callID, sess.Language, len(audio))
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

// exotelAnswer is called by Exotel when the parent picks up.
// Returns ExoML — either <Play> with Sarvam AI audio or <Say> fallback.
func (s *Server) exotelAnswer(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	callSID := r.FormValue("CallSid")
	log.Printf("[answer] callSID=%s", callSID)

	sess, ok := s.Sessions.Get(callSID)
	if !ok {
		// Unknown session — play a generic message and hang up
		w.Header().Set("Content-Type", "text/xml")
		w.Write([]byte(exoml.SayAndHangup("Hello, this is RVCE college. Please contact us at the main office.", "en-IN", "")))
		return
	}

	sess.TransitionTo(orchestrator.StateConnected)

	script := exoml.OpeningScript(sess.Language, sess.CallType, sess.StudentID)
	langCode := tts.LangCode(sess.Language)

	var audioURL string
	if audio, ok := s.getAudio(callSID); ok && len(audio) > 0 {
		audioURL = s.PublicBase + "/voice/audio/" + callSID
		_ = audio // already stored; serveAudio will stream it
	}

	w.Header().Set("Content-Type", "text/xml")
	w.Write([]byte(exoml.SayAndHangup(script, langCode, audioURL)))
}

func (s *Server) exotelWebhook(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	callSID := r.FormValue("CallSid")
	status := r.FormValue("Status")
	log.Printf("[webhook] callSID=%s status=%s", callSID, status)
	if sess, ok := s.Sessions.Get(callSID); ok {
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

func (s *Server) exotelDTMF(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	callSID := r.FormValue("CallSid")
	digits := r.FormValue("Digits")
	log.Printf("[dtmf] callSID=%s digits=%s", callSID, digits)
	if sess, ok := s.Sessions.Get(callSID); ok {
		sess.PushDTMF(digits)
	}
	w.WriteHeader(http.StatusNoContent)
}

// serveAudio streams the pre-generated Sarvam WAV for a call.
func (s *Server) serveAudio(w http.ResponseWriter, r *http.Request) {
	callID := r.URL.Path[len("/voice/audio/"):]
	audio, ok := s.getAudio(callID)
	if !ok {
		http.Error(w, "audio not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "audio/wav")
	w.Header().Set("Content-Length", string(rune(len(audio))))
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
