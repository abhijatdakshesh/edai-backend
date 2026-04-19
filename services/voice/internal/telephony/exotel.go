// Package telephony provides the Exotel API client for outbound calls.
package telephony

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// ExotelClient places and manages outbound calls via the Exotel REST API.
type ExotelClient struct {
	APIKEY         string
	APIToken       string
	SID            string
	VirtualNumber  string
	HTTPClient     *http.Client
}

func NewExotelClient(apiKey, apiToken, sid, virtualNumber string) *ExotelClient {
	return &ExotelClient{
		APIKEY:        apiKey,
		APIToken:      apiToken,
		SID:           sid,
		VirtualNumber: virtualNumber,
		HTTPClient:    &http.Client{Timeout: 15 * time.Second},
	}
}

// PlaceCall initiates an outbound call via Exotel.
// Returns the Exotel call SID.
func (c *ExotelClient) PlaceCall(ctx context.Context, toNumber, appID string) (string, error) {
	endpoint := fmt.Sprintf(
		"https://api.exotel.com/v1/Accounts/%s/Calls/connect",
		c.SID,
	)
	data := url.Values{}
	data.Set("From", c.VirtualNumber)
	data.Set("To", toNumber)
	data.Set("Sid", c.SID)
	if appID != "" {
		data.Set("AppId", appID)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewBufferString(data.Encode()))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(c.APIKEY, c.APIToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("exotel place call: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Call struct {
			Sid string `json:"Sid"`
		} `json:"Call"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("exotel decode: %w", err)
	}
	return result.Call.Sid, nil
}

// GetCallStatus fetches current status of an Exotel call.
func (c *ExotelClient) GetCallStatus(ctx context.Context, callSID string) (string, error) {
	endpoint := fmt.Sprintf(
		"https://api.exotel.com/v1/Accounts/%s/Calls/%s.json",
		c.SID, callSID,
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(c.APIKEY, c.APIToken)
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Call struct {
			Status string `json:"Status"`
		} `json:"Call"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Call.Status, nil
}
