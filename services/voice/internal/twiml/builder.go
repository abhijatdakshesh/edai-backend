// Package twiml builds Twilio Markup Language XML responses.
package twiml

import (
	"encoding/xml"
	"fmt"
	"strings"
)

// esc XML-escapes a string for safe interpolation into TwiML.
func esc(s string) string {
	var b strings.Builder
	xml.EscapeText(&b, []byte(s))
	return b.String()
}

func Response(inner string) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?><Response>%s</Response>`, inner)
}

func Say(text, lang string) string {
	return fmt.Sprintf(`<Say language="%s">%s</Say>`, esc(lang), esc(text))
}

func Play(audioURL string) string {
	return fmt.Sprintf(`<Play>%s</Play>`, esc(audioURL))
}

func Pause(seconds int) string {
	return fmt.Sprintf(`<Pause length="%d"/>`, seconds)
}

func Hangup() string { return "<Hangup/>" }

// PlayAndHangup plays audio then hangs up.
func PlayAndHangup(audioURL string) string {
	return Response(Play(audioURL) + Pause(1) + Hangup())
}

// SayAndHangup speaks text then hangs up.
func SayAndHangup(text, lang string) string {
	return Response(Say(text, lang) + Pause(1) + Hangup())
}

// PlayAndGather plays audio inside <Gather> so early DTMF is captured.
func PlayAndGather(audioURL, action string, numDigits, timeout int) string {
	inner := fmt.Sprintf(`<Gather action="%s" method="POST" numDigits="%d" timeout="%d"><Play>%s</Play></Gather>`,
		esc(action), numDigits, timeout, esc(audioURL))
	return Response(inner)
}

// SayAndGather speaks text inside <Gather> so early DTMF is captured. (#12 fix)
func SayAndGather(text, lang, action string, numDigits, timeout int) string {
	inner := fmt.Sprintf(`<Gather action="%s" method="POST" numDigits="%d" timeout="%d"><Say language="%s">%s</Say></Gather>`,
		esc(action), numDigits, timeout, esc(lang), esc(text))
	return Response(inner)
}
