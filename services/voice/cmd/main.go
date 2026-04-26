// EdAI Voice Service — Go entrypoint
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
	"github.com/edai/voice/internal/tts"
)

func main() {
	port := getenv("PORT", "8090")
	kafkaBrokers := getenv("KAFKA_BROKERS", "localhost:9092")
	aiEngineURL := getenv("AI_ENGINE_URL", "http://localhost:8001")
	sarvamAPIKey := getenv("SARVAM_API_KEY", "")
	publicBase := getenv("PUBLIC_BASE_URL", "http://localhost:8090")

	sessions := orchestrator.NewSessionRegistry()
	sarvamClient := tts.NewSarvamClient(sarvamAPIKey)
	server := api.NewServer(sessions, aiEngineURL, sarvamClient, publicBase)

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

	// Start Kafka consumer in background goroutine
	go kafka.ConsumeAbsentEvents(ctx, kafkaBrokers, func(evt kafka.AbsentMarkedEvent) {
		if !evt.ConsentVoice {
			log.Printf("Skipping call: parent %s has no voice consent", evt.ParentID)
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
		log.Printf("Auto-triggered call from Kafka event: callID=%s student=%s", callID, evt.StudentID)
		// Production: call Exotel client to place the call here
	})

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Voice service listening on :%s", port)
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
