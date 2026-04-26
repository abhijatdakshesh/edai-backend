// Package telephony provides a Twilio REST client for outbound calls.
package telephony

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"time"
)

// TwilioClient places outbound calls via the Twilio REST API.
type TwilioClient struct {
	AccountSID string
	AuthToken  string
	FromNumber string
	HTTPClient *http.Client
}

// ValidateTwilioSignature verifies X-Twilio-Signature per Twilio's HMAC-SHA1 scheme.
// fullURL must be the exact URL Twilio called (scheme + host + path + query).
// postParams is r.PostForm (parsed before calling this).
func ValidateTwilioSignature(authToken, fullURL string, postParams url.Values, signature string) bool {
	if signature == "" {
		return false
	}
	// Build validation string: URL + sorted(key+value pairs)
	s := fullURL
	keys := make([]string, 0, len(postParams))
	for k := range postParams {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		s += k + postParams.Get(k)
	}
	mac := hmac.New(sha1.New, []byte(authToken))
	mac.Write([]byte(s))
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func NewTwilioClient(accountSID, authToken, fromNumber string) *TwilioClient {
	return &TwilioClient{
		AccountSID: accountSID,
		AuthToken:  authToken,
		FromNumber: fromNumber,
		HTTPClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// PlaceCallWithURL dials toPhone and instructs Twilio to fetch TwiML from answerURL.
// statusURL (optional) receives call status callbacks.
// Returns the Twilio CallSid on success.
func (c *TwilioClient) PlaceCallWithURL(ctx context.Context, toPhone, answerURL, statusURL string) (string, error) {
	if c.AccountSID == "" || c.AuthToken == "" {
		return "", fmt.Errorf("twilio credentials not configured")
	}
	endpoint := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Calls.json", c.AccountSID)

	data := url.Values{}
	data.Set("To", toPhone)
	data.Set("From", c.FromNumber)
	data.Set("Url", answerURL)
	if statusURL != "" {
		data.Set("StatusCallback", statusURL)
		data.Set("StatusCallbackMethod", "POST")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewBufferString(data.Encode()))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(c.AccountSID, c.AuthToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("twilio place call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		var errResp struct {
			Message string `json:"message"`
			Code    int    `json:"code"`
		}
		json.NewDecoder(resp.Body).Decode(&errResp)
		return "", fmt.Errorf("twilio %d: %s (code %d)", resp.StatusCode, errResp.Message, errResp.Code)
	}

	var result struct {
		SID string `json:"sid"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("twilio decode: %w", err)
	}
	return result.SID, nil
}
