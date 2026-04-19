// Package telephony manages outbound call sessions and events.
package telephony

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// CallRequest is received from upstream services (e.g. after AbsenteeDetected event).
type CallRequest struct {
	ParentID         string `json:"parentId"`
	StudentID        string `json:"studentId"`
	ParentPhoneToken string `json:"parentPhoneToken"`
	Language         string `json:"language"`
	Script           string `json:"script"`
}

// CallSession represents an initiated call.
type CallSession struct {
	CallID     string    `json:"callId"`
	ParentID   string    `json:"parentId"`
	StudentID  string    `json:"studentId"`
	Status     string    `json:"status"`
	InitiatedAt time.Time `json:"initiatedAt"`
}

// CallCompletePayload is sent by the Exotel webhook or manually.
type CallCompletePayload struct {
	CallID          string `json:"callId"`
	ParentID        string `json:"parentId"`
	StudentID       string `json:"studentId"`
	Disposition     string `json:"disposition"`
	DurationSeconds int    `json:"durationSeconds"`
	RecordingURL    string `json:"recordingUrl,omitempty"`
}

// CallCompletedEvent is published to Kafka voice.CallCompleted.
type CallCompletedEvent struct {
	EventID         string    `json:"eventId"`
	CallID          string    `json:"callId"`
	ParentID        string    `json:"parentId"`
	StudentID       string    `json:"studentId"`
	Language        string    `json:"language"`
	Disposition     string    `json:"disposition"`
	Summary         string    `json:"summary"`
	RecordingURL    string    `json:"recordingUrl,omitempty"`
	DurationSeconds int       `json:"durationSeconds"`
	OccurredAt      time.Time `json:"occurredAt"`
}

// InitiateCall creates a new call session (stub — production dials via Exotel API).
func InitiateCall(req CallRequest) CallSession {
	return CallSession{
		CallID:      fmt.Sprintf("call-%s", uuid.New().String()),
		ParentID:    req.ParentID,
		StudentID:   req.StudentID,
		Status:      "INITIATED",
		InitiatedAt: time.Now().UTC(),
	}
}

// BuildCallCompletedEvent constructs the Kafka event from a completed call payload.
func BuildCallCompletedEvent(p CallCompletePayload) CallCompletedEvent {
	return CallCompletedEvent{
		EventID:         uuid.New().String(),
		CallID:          p.CallID,
		ParentID:        p.ParentID,
		StudentID:       p.StudentID,
		Language:        "kn",
		Disposition:     p.Disposition,
		Summary:         fmt.Sprintf("Call to parent of student %s: %s", p.StudentID, p.Disposition),
		RecordingURL:    p.RecordingURL,
		DurationSeconds: p.DurationSeconds,
		OccurredAt:      time.Now().UTC(),
	}
}
