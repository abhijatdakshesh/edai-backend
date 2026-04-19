// Package telephony — Exotel webhook handler for call state changes and DTMF.
package telephony

import (
	"log"
	"net/http"
)

// WebhookPayload is the body sent by Exotel on call state changes.
type WebhookPayload struct {
	CallSID    string `form:"CallSid"`
	Status     string `form:"Status"`
	Direction  string `form:"Direction"`
	From       string `form:"From"`
	To         string `form:"To"`
	Duration   string `form:"Duration"`
	RecordURL  string `form:"RecordingUrl"`
	DTMFDigits string `form:"Digits"`
}

// DTMFWebhookPayload carries DTMF keypresses from the Exotel flow.
type DTMFWebhookPayload struct {
	CallSID string `form:"CallSid"`
	Digits  string `form:"Digits"`
}

// ExotelWebhookHandler returns an http.HandlerFunc that processes Exotel state webhooks.
// The onStateChange callback is invoked with (callSID, newStatus).
func ExotelWebhookHandler(onStateChange func(callSID, status string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		payload := WebhookPayload{
			CallSID: r.FormValue("CallSid"),
			Status:  r.FormValue("Status"),
		}
		log.Printf("Exotel webhook: callSID=%s status=%s", payload.CallSID, payload.Status)
		if onStateChange != nil {
			onStateChange(payload.CallSID, payload.Status)
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// ExotelDTMFWebhookHandler processes DTMF digit webhooks.
// The onDTMF callback receives (callSID, digits).
func ExotelDTMFWebhookHandler(onDTMF func(callSID, digits string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		callSID := r.FormValue("CallSid")
		digits := r.FormValue("Digits")
		log.Printf("Exotel DTMF: callSID=%s digits=%s", callSID, digits)
		if onDTMF != nil {
			onDTMF(callSID, digits)
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
