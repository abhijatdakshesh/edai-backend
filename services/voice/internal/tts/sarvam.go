// Package tts provides text-to-speech synthesis via Sarvam AI.
package tts

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// LangCode maps internal language codes to Sarvam AI language codes.
func LangCode(lang string) string {
	switch lang {
	case "kn":
		return "kn-IN"
	case "hi":
		return "hi-IN"
	case "ta":
		return "ta-IN"
	case "te":
		return "te-IN"
	default:
		return "en-IN"
	}
}

// ExotelLang maps internal language codes to Exotel <Say> language codes.
func ExotelLang(lang string) string {
	return LangCode(lang) // same format
}

type SarvamClient struct {
	APIKey     string
	HTTPClient *http.Client
}

func NewSarvamClient(apiKey string) *SarvamClient {
	return &SarvamClient{
		APIKey:     apiKey,
		HTTPClient: &http.Client{Timeout: 15 * time.Second},
	}
}

type ttsRequest struct {
	Inputs              []string `json:"inputs"`
	TargetLanguageCode  string   `json:"target_language_code"`
	Speaker             string   `json:"speaker"`
	Model               string   `json:"model"`
	Pitch               float64  `json:"pitch"`
	Pace                float64  `json:"pace"`
	Loudness            float64  `json:"loudness"`
	EnablePreprocessing bool     `json:"enable_preprocessing"`
}

type ttsResponse struct {
	Audios []string `json:"audios"` // base64-encoded WAV
}

// Synthesise calls Sarvam AI TTS and returns raw WAV bytes.
func (c *SarvamClient) Synthesise(ctx context.Context, text, lang, speaker string) ([]byte, error) {
	if c.APIKey == "" {
		return nil, fmt.Errorf("SARVAM_API_KEY not set")
	}
	if speaker == "" {
		speaker = "anushka"
	}
	body, err := json.Marshal(ttsRequest{
		Inputs:              []string{text},
		TargetLanguageCode:  LangCode(lang),
		Speaker:             speaker,
		Model:               "bulbul:v2",
		Pitch:               0,
		Pace:                1.0,
		Loudness:            1.5,
		EnablePreprocessing: true,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.sarvam.ai/text-to-speech", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("api-subscription-key", c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sarvam request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sarvam status %d", resp.StatusCode)
	}

	var result ttsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("sarvam decode: %w", err)
	}
	if len(result.Audios) == 0 {
		return nil, fmt.Errorf("sarvam: no audio returned")
	}
	return base64.StdEncoding.DecodeString(result.Audios[0])
}
