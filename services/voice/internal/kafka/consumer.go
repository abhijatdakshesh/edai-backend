// Package kafka — Kafka consumer for voice service.
// Subscribes to attendance.absent.marked and escalation.* topics.
package kafka

import (
	"context"
	"log"
	"time"
)

// AbsentMarkedEvent mirrors the Avro schema for attendance.absent.marked.
type AbsentMarkedEvent struct {
	EventID          string `json:"eventId"`
	StudentID        string `json:"studentId"`
	StudentName      string `json:"studentName"`
	ClassID          string `json:"classId"`
	InstitutionID    string `json:"institutionId"`
	Date             string `json:"date"`
	Period           *int   `json:"period,omitempty"`
	ParentID         string `json:"parentId"`
	ParentPhone      string `json:"parentPhone"`      // E.164 phone number (populated by identity service)
	ParentPhoneToken string `json:"parentPhoneToken"` // legacy encrypted token
	ParentLanguage   string `json:"parentLanguage"`
	ConsentVoice     bool   `json:"consentVoice"`
	ConsentWhatsapp  bool   `json:"consentWhatsapp"`
	TeacherID        string `json:"teacherId"`
	MarkedAt         int64  `json:"markedAt"`
}

// ConsumeAbsentEvents is a stub consumer loop.
// Production: replace with github.com/segmentio/kafka-go or franz-go Reader.
func ConsumeAbsentEvents(ctx context.Context, brokers string, onEvent func(AbsentMarkedEvent)) {
	log.Printf("Kafka consumer: listening on %s topic=attendance.absent.marked", brokers)
	// Production loop:
	// reader := kafka.NewReader(kafka.ReaderConfig{Brokers: []string{brokers}, Topic: "attendance.absent.marked", GroupID: "voice-service"})
	// for { msg, err := reader.ReadMessage(ctx); ... }

	// Stub: emit a test event every 60s in dev mode
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			log.Println("Kafka consumer stub: no real messages (dev mode)")
		}
	}
}
