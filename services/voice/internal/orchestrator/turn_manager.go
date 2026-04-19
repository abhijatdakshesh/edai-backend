// Package orchestrator — turn manager drives the listen→transcribe→decide→speak loop.
package orchestrator

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// TurnManager drives a single AI call turn: ASR → LLM → TTS.
type TurnManager struct {
	AIEngineURL string
	HTTPClient  *http.Client
}

func NewTurnManager(aiEngineURL string) *TurnManager {
	return &TurnManager{
		AIEngineURL: aiEngineURL,
		HTTPClient:  &http.Client{Timeout: 10 * time.Second},
	}
}

type dialogueTurnReq struct {
	CallType            string                   `json:"call_type"`
	ConversationHistory []map[string]interface{} `json:"conversation_history"`
	StudentContext      map[string]interface{}   `json:"student_context"`
	InstitutionName     string                   `json:"institution_name"`
	CurrentTranscript   string                   `json:"current_transcript"`
	Language            string                   `json:"language"`
}

type dialogueTurnResp struct {
	NextUtterance  string `json:"next_utterance"`
	ShouldEscalate bool   `json:"should_escalate"`
	CallComplete   bool   `json:"call_complete"`
	CollectedReason string `json:"collected_reason"`
	DTMFExpected   bool   `json:"dtmf_expected"`
}

type ttsReq struct {
	Text     string  `json:"text"`
	Language string  `json:"language"`
	Gender   string  `json:"gender"`
	Speed    float64 `json:"speed"`
}

// ProcessTurn: given a transcript segment, call LLM, get response, call TTS.
// Returns the audio bytes to stream into the RTP bridge.
func (tm *TurnManager) ProcessTurn(
	ctx context.Context,
	s *CallSession,
	transcript string,
	history []map[string]interface{},
) (*dialogueTurnResp, []byte, error) {
	// Step 1: LLM dialogue turn
	reqBody := dialogueTurnReq{
		CallType:            s.CallType,
		ConversationHistory: history,
		StudentContext:      s.StudentContext,
		InstitutionName:     "RV Educational Institutions",
		CurrentTranscript:   transcript,
		Language:            s.Language,
	}
	body, _ := json.Marshal(reqBody)
	resp, err := tm.HTTPClient.Post(tm.AIEngineURL+"/llm/dialogue-turn", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, nil, fmt.Errorf("LLM dialogue-turn: %w", err)
	}
	defer resp.Body.Close()

	var turn dialogueTurnResp
	if err := json.NewDecoder(resp.Body).Decode(&turn); err != nil {
		return nil, nil, fmt.Errorf("decode dialogue-turn: %w", err)
	}

	if turn.NextUtterance == "" {
		return &turn, nil, nil
	}

	// Step 2: TTS synthesis
	ttsBody, _ := json.Marshal(ttsReq{Text: turn.NextUtterance, Language: s.Language, Gender: "female", Speed: 1.0})
	ttsResp, err := tm.HTTPClient.Post(tm.AIEngineURL+"/tts/synthesise", "application/json", bytes.NewReader(ttsBody))
	if err != nil {
		log.Printf("TTS error (non-fatal): %v", err)
		return &turn, nil, nil
	}
	defer ttsResp.Body.Close()

	var ttsResult struct {
		AudioBase64 string `json:"audio_base64"`
	}
	json.NewDecoder(ttsResp.Body).Decode(&ttsResult)

	// Production: base64-decode and stream into RTP bridge
	return &turn, []byte(ttsResult.AudioBase64), nil
}

// DTMFMap maps keypress digits to human-readable reasons.
var DTMFMap = map[string]string{
	"1": "Sick/unwell",
	"2": "Running late",
	"3": "Other reason",
}
