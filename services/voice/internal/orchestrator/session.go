// Package orchestrator manages the per-call state machine and turn loop.
package orchestrator

import (
	"context"
	"sync"
	"time"
)

// CallState represents the lifecycle of one outbound AI call.
type CallState string

const (
	StateInitiated  CallState = "INITIATED"
	StateRinging    CallState = "RINGING"
	StateConnected  CallState = "CONNECTED"
	StateActive     CallState = "ACTIVE"
	StateCompleted  CallState = "COMPLETED"
	StateFailed     CallState = "FAILED"
	StateNoAnswer   CallState = "NO_ANSWER"
	StateBusy       CallState = "BUSY"
)

// CallSession holds the in-memory state for one AI voice call.
type CallSession struct {
	mu sync.RWMutex

	CallID         string
	StudentID      string
	ParentID       string
	Language       string
	CallType       string // ABSENT_CALL | FEE_REMINDER | WEEKLY_UPDATE | ASSIGNMENT_MISS
	InstitutionID  string
	State          CallState
	StartedAt      time.Time
	ConnectedAt    *time.Time
	EndedAt        *time.Time
	AttemptNumber  int
	DurationSecs   int
	CollectedReason string
	Sentiment      string
	Escalated      bool
	SummaryEn      string
	DTMFChan       chan string // receives DTMF digits from webhook goroutine

	// StudentContext passed to LLM on every turn
	StudentContext map[string]interface{}
}

func NewCallSession(callID, studentID, parentID, language, callType, institutionID string, studentCtx map[string]interface{}) *CallSession {
	return &CallSession{
		CallID:         callID,
		StudentID:      studentID,
		ParentID:       parentID,
		Language:       language,
		CallType:       callType,
		InstitutionID:  institutionID,
		State:          StateInitiated,
		StartedAt:      time.Now(),
		AttemptNumber:  1,
		DTMFChan:       make(chan string, 4),
		StudentContext: studentCtx,
	}
}

func (s *CallSession) TransitionTo(newState CallState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.State = newState
	if newState == StateConnected {
		now := time.Now()
		s.ConnectedAt = &now
	}
	if newState == StateCompleted || newState == StateFailed || newState == StateNoAnswer || newState == StateBusy {
		now := time.Now()
		s.EndedAt = &now
		if s.ConnectedAt != nil {
			s.DurationSecs = int(now.Sub(*s.ConnectedAt).Seconds())
		}
	}
}

func (s *CallSession) GetState() CallState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.State
}

func (s *CallSession) PushDTMF(digit string) {
	select {
	case s.DTMFChan <- digit:
	default:
		// buffer full, discard
	}
}

// SessionRegistry is a thread-safe map of active call sessions.
type SessionRegistry struct {
	mu       sync.RWMutex
	sessions map[string]*CallSession
}

func NewSessionRegistry() *SessionRegistry {
	return &SessionRegistry{sessions: make(map[string]*CallSession)}
}

func (r *SessionRegistry) Add(s *CallSession) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sessions[s.CallID] = s
}

func (r *SessionRegistry) Get(callID string) (*CallSession, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.sessions[callID]
	return s, ok
}

func (r *SessionRegistry) Remove(callID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.sessions, callID)
}

func (r *SessionRegistry) ActiveCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.sessions)
}

// WaitForDTMF waits up to timeout for the parent to press a digit.
func WaitForDTMF(ctx context.Context, s *CallSession, timeout time.Duration) (string, bool) {
	select {
	case digit := <-s.DTMFChan:
		return digit, true
	case <-time.After(timeout):
		return "", false
	case <-ctx.Done():
		return "", false
	}
}
