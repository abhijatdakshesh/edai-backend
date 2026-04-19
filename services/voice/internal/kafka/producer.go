// Package kafka — Kafka producer for voice.call.completed events.
package kafka

import (
	"encoding/json"
	"log"
	"time"
)

// CallCompletedEvent mirrors the Avro schema for voice.call.completed.
type CallCompletedEvent struct {
	EventID         string `json:"eventId"`
	CallID          string `json:"callId"`
	StudentID       string `json:"studentId"`
	ParentID        string `json:"parentId"`
	Outcome         string `json:"outcome"`
	CollectedReason string `json:"collectedReason,omitempty"`
	Sentiment       string `json:"sentiment"`
	Escalated       bool   `json:"escalated"`
	SummaryEn       string `json:"summaryEn"`
	DurationSeconds int    `json:"durationSeconds"`
	Timestamp       int64  `json:"timestamp"`
}

// EmitCallCompleted publishes a voice.call.completed event.
// Production: use kafka.Writer.WriteMessages().
func EmitCallCompleted(brokers string, evt CallCompletedEvent) error {
	evt.Timestamp = time.Now().UnixMilli()
	payload, err := json.Marshal(evt)
	if err != nil {
		return err
	}
	// Production:
	// writer.WriteMessages(ctx, kafka.Message{Topic: "voice.call.completed", Value: payload})
	log.Printf("KAFKA emit voice.call.completed: %s", payload)
	return nil
}
