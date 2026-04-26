// Package api provides the HTTP layer for the voice service.
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
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
var allIntents = []string{"ACK", "SICK", "CALLBACK", "GOODBYE", "UNSUBSCRIBE"}

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

// pregenAllAudio generates WAV for all lang×callType and lang×intent combos.
func (s *Server) pregenAllAudio() {
	log.Println("[pregen] Starting pre-generation (openings + responses)...")
	gen := func(key, script, lang string) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		audio, err := s.Sarvam.Synthesise(ctx, script, lang, "anushka")
		cancel()
		if err != nil {
			log.Printf("[pregen] FAILED %s: %v", key, err)
			return
		}
		s.audioMu.Lock()
		s.prebuilt[key] = audio
		s.audioMu.Unlock()
		log.Printf("[pregen] OK %s bytes=%d", key, len(audio))
	}
	for _, lang := range allLangs {
		for _, callType := range allCallTypes {
			gen(lang+":"+callType, exoml.OpeningScript(lang, callType, "your child"), lang)
		}
		for _, intent := range allIntents {
			gen("resp:"+lang+":"+intent, exoml.ResponseScript(lang, intent), lang)
		}
	}
	log.Println("[pregen] Done — all audio ready")
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
	mux.HandleFunc("/voice/webhook/twilio/answer", s.twilioSig(s.twilioAnswer))
	mux.HandleFunc("/voice/webhook/twilio/gather", s.twilioSig(s.twilioGather))
	mux.HandleFunc("/voice/webhook/twilio/status", s.twilioSig(s.twilioStatus))
	mux.HandleFunc("/voice/audio/", s.serveAudio)
	mux.HandleFunc("/health", s.health)
}

// SkipSigValidation disables X-Twilio-Signature checking (dev/tunnel mode only).
var SkipSigValidation = false

// twilioSig validates X-Twilio-Signature before allowing the handler to run.
// In production (SkipSigValidation=false) rejects requests with invalid signatures.
func (s *Server) twilioSig(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		if !SkipSigValidation {
			sig := r.Header.Get("X-Twilio-Signature")
			fullURL := s.WebhookBase + r.URL.RequestURI()
			if !telephony.ValidateTwilioSignature(s.Twilio.AuthToken, fullURL, r.PostForm, sig) {
				log.Printf("[sig] REJECTED path=%s sig=%q url=%s", r.URL.Path, sig, fullURL)
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
		}
		next(w, r)
	}
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
		studentName := studentNameFromContext(sess)
		script := exoml.OpeningScript(sess.Language, sess.CallType, studentName)
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
	speechLang := tts.LangCode(sess.Language)

	// Prefer per-call personalised audio, then prebuilt, then Twilio built-in TTS.
	s.audioMu.RLock()
	_, hasCallAudio := s.audioStore[callID]
	_, hasPrebuilt := s.prebuilt[sess.Language+":"+sess.CallType]
	s.audioMu.RUnlock()

	if hasCallAudio {
		audioURL := fmt.Sprintf("%s/voice/audio/%s", s.WebhookBase, callID)
		w.Write([]byte(twiml.InteractiveGather(audioURL, gatherURL, speechLang)))
		return
	}
	if hasPrebuilt {
		audioURL := fmt.Sprintf("%s/voice/audio/open?key=%s:%s", s.WebhookBase, sess.Language, sess.CallType)
		w.Write([]byte(twiml.InteractiveGather(audioURL, gatherURL, speechLang)))
		return
	}
	script := exoml.OpeningScript(sess.Language, sess.CallType, studentNameFromContext(sess))
	w.Write([]byte(twiml.InteractiveSay(script, speechLang, gatherURL, speechLang)))
}

// twilioGather handles parent speech/DTMF input and plays a contextual response.
func (s *Server) twilioGather(w http.ResponseWriter, r *http.Request) {
	callID := r.URL.Query().Get("callId")
	speech := r.FormValue("SpeechResult")
	digits := r.FormValue("Digits")
	log.Printf("[gather] callID=%s digits=%q speech=%q", callID, digits, speech)

	w.Header().Set("Content-Type", "text/xml")

	sess, ok := s.Sessions.Get(callID)
	if !ok {
		w.Write([]byte(twiml.SayAndHangup("Thank you. Goodbye.", "en-IN")))
		return
	}
	if digits != "" {
		sess.PushDTMF(digits)
	}

	intent := detectIntent(speech, digits)
	lang := sess.Language
	log.Printf("[gather] callID=%s intent=%s lang=%s", callID, intent, lang)

	respKey := "resp:" + lang + ":" + intent
	s.audioMu.RLock()
	_, hasResp := s.prebuilt[respKey]
	s.audioMu.RUnlock()

	if hasResp {
		audioURL := fmt.Sprintf("%s/voice/audio/resp?key=%s", s.WebhookBase, respKey)
		w.Write([]byte(twiml.PlayAndHangup(audioURL)))
		return
	}
	// Fallback TTS response
	w.Write([]byte(twiml.SayAndHangup(exoml.ResponseScript(lang, intent), tts.LangCode(lang))))
}

// detectIntent maps speech transcript and DTMF digits to a response intent.
func detectIntent(speech, digits string) string {
	switch digits {
	case "1":
		return "ACK"
	case "2":
		return "SICK"
	case "3":
		return "CALLBACK"
	case "9":
		return "UNSUBSCRIBE"
	}
	if speech == "" {
		return "GOODBYE"
	}
	lower := strings.ToLower(speech)
	for _, w := range []string{"sick", "ill", "fever", "hospital", "doctor", "unwell",
		"bimaar", "bimari", "taklif", "noi", "odambu", "vyadhi", "jaramu", "javvaru"} {
		if strings.Contains(lower, w) {
			return "SICK"
		}
	}
	for _, w := range []string{"teacher", "call back", "callback", "speak", "talk", "principal",
		"adhyapak", "shikshak", "aasiriyar", "guruvugaru", "matlaadi", "maataadi"} {
		if strings.Contains(lower, w) {
			return "CALLBACK"
		}
	}
	for _, w := range []string{"ok", "okay", "yes", "noted", "understand", "haan", "theek",
		"sahi", "sari", "ama", "aama", "avunu", "purinchindi"} {
		if strings.Contains(lower, w) {
			return "ACK"
		}
	}
	return "GOODBYE"
}

// twilioStatus handles call status callbacks from Twilio.
func (s *Server) twilioStatus(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	callID := r.URL.Query().Get("callId")
	status := r.FormValue("CallStatus")
	log.Printf("[status] callID=%s status=%s", callID, status)

	terminal := false
	if sess, ok := s.Sessions.Get(callID); ok {
		switch status {
		case "ringing":
			sess.TransitionTo(orchestrator.StateRinging)
		case "in-progress":
			sess.TransitionTo(orchestrator.StateConnected)
		case "completed":
			sess.TransitionTo(orchestrator.StateCompleted)
			terminal = true
		case "no-answer":
			sess.TransitionTo(orchestrator.StateNoAnswer)
			terminal = true
		case "busy":
			sess.TransitionTo(orchestrator.StateBusy)
			terminal = true
		case "failed":
			sess.TransitionTo(orchestrator.StateFailed)
			terminal = true
		}
	}
	// Remove completed sessions after grace period to prevent memory leak.
	if terminal {
		go func() {
			time.Sleep(5 * time.Minute)
			s.Sessions.Remove(callID)
		}()
	}
	w.WriteHeader(http.StatusNoContent)
}

// serveAudio serves WAV audio from the prebuilt map or per-call store.
// Paths: /voice/audio/<callID>  (per-call personalised)
//        /voice/audio/open?key=lang:callType  (prebuilt opening)
//        /voice/audio/resp?key=resp:lang:intent  (prebuilt response)
func (s *Server) serveAudio(w http.ResponseWriter, r *http.Request) {
	segment := r.URL.Path[len("/voice/audio/"):]
	key := r.URL.Query().Get("key")

	var audio []byte
	s.audioMu.RLock()
	if segment == "open" || segment == "resp" {
		audio = s.prebuilt[key]
	} else {
		// Per-call personalised audio
		if e, ok := s.audioStore[segment]; ok && time.Now().Before(e.expiresAt) {
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

// studentNameFromContext extracts the student display name from session context.
// Falls back to StudentID if name is absent (prevents UUID being spoken aloud).
func studentNameFromContext(sess *orchestrator.CallSession) string {
	if name, ok := sess.StudentContext["name"].(string); ok && name != "" {
		return name
	}
	return sess.StudentID
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
