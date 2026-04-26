// EdAI Voice Service — Twilio + Sarvam AI entrypoint
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/edai/voice/internal/api"
	"github.com/edai/voice/internal/kafka"
	"github.com/edai/voice/internal/orchestrator"
	"github.com/edai/voice/internal/telephony"
	"github.com/edai/voice/internal/tts"
)

func main() {
	port := getenv("PORT", "8090")
	kafkaBrokers := getenv("KAFKA_BROKERS", "localhost:9092")
	aiEngineURL := getenv("AI_ENGINE_URL", "http://localhost:8001")

	// Sarvam AI TTS
	sarvamAPIKey := getenv("SARVAM_API_KEY", "")
	sarvamClient := tts.NewSarvamClient(sarvamAPIKey)

	// Twilio
	twilioClient := telephony.NewTwilioClient(
		getenv("TWILIO_ACCOUNT_SID", ""),
		getenv("TWILIO_AUTH_TOKEN", ""),
		getenv("TWILIO_FROM_NUMBER", ""),
	)

	// Public webhook base URL (Cloudflare tunnel / ngrok in dev, HTTPS host in prod)
	webhookBase := getenv("WEBHOOK_BASE_URL", "http://localhost:8090")

	sessions := orchestrator.NewSessionRegistry()
	server := api.NewServer(sessions, aiEngineURL, sarvamClient, twilioClient, webhookBase)

	mux := http.NewServeMux()
	server.RegisterRoutes(mux)

	httpServer := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start Kafka consumer — auto-triggered absent calls.
	go kafka.ConsumeAbsentEvents(ctx, kafkaBrokers, func(evt kafka.AbsentMarkedEvent) {
		if !evt.ConsentVoice {
			log.Printf("Skipping call: parent %s has no voice consent", evt.ParentID)
			return
		}
		if evt.ParentPhone == "" {
			log.Printf("Skipping call: no parent phone for student %s", evt.StudentID)
			return
		}
		callID := evt.EventID
		sess := orchestrator.NewCallSession(
			callID,
			evt.StudentID,
			evt.ParentID,
			evt.ParentLanguage,
			"ABSENT_CALL",
			evt.InstitutionID,
			map[string]interface{}{
				"name":       evt.StudentName,
				"class_name": evt.ClassID,
			},
		)
		sessions.Add(sess)
		log.Printf("Kafka auto-call: callID=%s student=%s lang=%s phone=%s",
			callID, evt.StudentID, evt.ParentLanguage, maskPhone(evt.ParentPhone))

		answerURL := webhookBase + "/voice/webhook/twilio/answer?callId=" + callID
		statusURL := webhookBase + "/voice/webhook/twilio/status?callId=" + callID
		go func() {
			placeCtx, placeCancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer placeCancel()
			sid, err := twilioClient.PlaceCallWithURL(placeCtx, evt.ParentPhone, answerURL, statusURL)
			if err != nil {
				log.Printf("Twilio place call error callID=%s: %v", callID, err)
				return
			}
			log.Printf("Twilio call placed callID=%s sid=%s", callID, sid)
		}()
	})

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Voice service listening on :%s (webhookBase=%s)", port, webhookBase)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-sigCh
	log.Println("Shutting down voice service…")
	cancel()

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()
	httpServer.Shutdown(shutCtx)
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// maskPhone masks a phone number for safe logging (DPDP Act 2023).
func maskPhone(phone string) string {
	if len(phone) <= 5 {
		return "****"
	}
	return phone[:3] + "****" + phone[len(phone)-2:]
}
