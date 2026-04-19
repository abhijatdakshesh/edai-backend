// Package api provides the HTTP layer for the voice service.
package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/edai/voice/internal/orchestrator"
)

// Server holds shared dependencies for all HTTP handlers.
type Server struct {
	Sessions *orchestrator.SessionRegistry
	AIEngine string
}

func NewServer(sessions *orchestrator.SessionRegistry, aiEngine string) *Server {
	return &Server{Sessions: sessions, AIEngine: aiEngine}
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/voice/calls/trigger", s.triggerCall)
	mux.HandleFunc("/voice/calls/", s.getCallStatus)
	mux.HandleFunc("/voice/webhook/exotel", s.exotelWebhook)
	mux.HandleFunc("/voice/webhook/exotel/dtmf", s.exotelDTMF)
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

	callID := uuid.New().String()
	sess := orchestrator.NewCallSession(callID, req.StudentID, req.ParentID, req.Language, req.CallType, req.InstitutionID, req.StudentContext)
	s.Sessions.Add(sess)

	log.Printf("Call triggered: callID=%s student=%s lang=%s type=%s", callID, req.StudentID, req.Language, req.CallType)

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
	json.NewEncoder(w).Encode(map[string]interface{}{
		"callId":   sess.CallID,
		"state":    sess.GetState(),
		"language": sess.Language,
		"callType": sess.CallType,
	})
}

func (s *Server) exotelWebhook(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	callSID := r.FormValue("CallSid")
	status := r.FormValue("Status")
	log.Printf("Exotel webhook: callSID=%s status=%s", callSID, status)
	// Map Exotel status to internal state and update session
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
	log.Printf("DTMF: callSID=%s digits=%s", callSID, digits)
	if sess, ok := s.Sessions.Get(callSID); ok {
		sess.PushDTMF(digits)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "ok",
		"service":     "voice",
		"activeCalls": s.Sessions.ActiveCount(),
		"timestamp":   time.Now().UTC(),
	})
}
