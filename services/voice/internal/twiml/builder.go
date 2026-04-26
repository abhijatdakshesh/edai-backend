// Package twiml builds Twilio Markup Language XML responses.
package twiml

import "fmt"

func Response(inner string) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?><Response>%s</Response>`, inner)
}

func Say(text, lang string) string {
	return fmt.Sprintf(`<Say language="%s">%s</Say>`, lang, text)
}

func Play(audioURL string) string {
	return fmt.Sprintf(`<Play>%s</Play>`, audioURL)
}

func Pause(seconds int) string {
	return fmt.Sprintf(`<Pause length="%d"/>`, seconds)
}

func Hangup() string { return "<Hangup/>" }

func Gather(action string, numDigits, timeout int) string {
	return fmt.Sprintf(`<Gather action="%s" method="POST" numDigits="%d" timeout="%d"/>`, action, numDigits, timeout)
}

// PlayAndHangup plays audio then hangs up.
func PlayAndHangup(audioURL string) string {
	return Response(Play(audioURL) + Pause(1) + Hangup())
}

// SayAndHangup speaks text then hangs up.
func SayAndHangup(text, lang string) string {
	return Response(Say(text, lang) + Pause(1) + Hangup())
}

// PlayAndGather plays audio then waits for DTMF.
func PlayAndGather(audioURL, action string, numDigits, timeout int) string {
	inner := fmt.Sprintf(`<Gather action="%s" method="POST" numDigits="%d" timeout="%d"><Play>%s</Play></Gather>`,
		action, numDigits, timeout, audioURL)
	return Response(inner)
}

// SayAndGather speaks text then waits for DTMF.
func SayAndGather(text, lang, action string, numDigits, timeout int) string {
	return Response(Say(text, lang) + Gather(action, numDigits, timeout))
}
