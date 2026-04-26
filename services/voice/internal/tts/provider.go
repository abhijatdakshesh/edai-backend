package tts

import (
	"context"
	"fmt"
)

// SynthesiseForLang synthesises text in the given language using the Sarvam client.
// Returns raw WAV bytes. Caller handles storage and URL generation via the existing
// in-memory audioStore pattern in api/rest.go — no S3/AWS dependency needed.
func SynthesiseForLang(ctx context.Context, client *SarvamClient, text, lang string) ([]byte, error) {
	if client == nil || client.APIKey == "" {
		return nil, fmt.Errorf("sarvam client not configured")
	}
	return client.Synthesise(ctx, text, lang, "pavithra")
}
