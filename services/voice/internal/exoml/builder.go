// Package exoml builds ExoML (Exotel Markup Language) XML responses.
package exoml

import "fmt"

// Response wraps an ExoML Response block.
func Response(inner string) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?><Response>%s</Response>`, inner)
}

// Say builds a <Say> tag with language and female voice.
func Say(text, lang string) string {
	return fmt.Sprintf(`<Say language="%s" voice="female">%s</Say>`, lang, text)
}

// Play builds a <Play> tag pointing to an audio URL.
func Play(url string) string {
	return fmt.Sprintf(`<Play>%s</Play>`, url)
}

// Gather builds a <Gather> tag that collects DTMF input.
func Gather(action string, numDigits, timeout int) string {
	return fmt.Sprintf(`<Gather action="%s" numDigits="%d" timeout="%d"/>`, action, numDigits, timeout)
}

// Hangup builds a <Hangup> tag.
func Hangup() string { return "<Hangup/>" }

// Pause builds a <Pause> tag.
func Pause(seconds int) string {
	return fmt.Sprintf(`<Pause length="%d"/>`, seconds)
}

// SayAndHangup returns ExoML that speaks text then hangs up.
// Falls back to Exotel built-in TTS if no audioURL is provided.
func SayAndHangup(text, lang, audioURL string) string {
	inner := ""
	if audioURL != "" {
		inner = Play(audioURL) + Pause(1) + Hangup()
	} else {
		inner = Say(text, lang) + Pause(1) + Hangup()
	}
	return Response(inner)
}

// SayAndGather returns ExoML that speaks text then waits for DTMF.
func SayAndGather(text, lang, audioURL, dtmfAction string, numDigits, timeout int) string {
	speakPart := ""
	if audioURL != "" {
		speakPart = Play(audioURL)
	} else {
		speakPart = Say(text, lang)
	}
	return Response(speakPart + Gather(dtmfAction, numDigits, timeout))
}

// OpeningScript returns the greeting script for each language and call type.
func OpeningScript(lang, callType, studentID string) string {
	scripts := map[string]map[string]string{
		"kn": {
			"ABSENT_CALL":     fmt.Sprintf("Namaskara! Idu RVCE college inda swayanchalita kareya aagide. Nimma magu %s indu college ge baralilla. Dayavittu maahiti nidi.", studentID),
			"FEE_REMINDER":    fmt.Sprintf("Namaskara! Idu RVCE college accounts vibhaga. %s avara fee payment baaki ide. Dayavittu sheegra pay maadi.", studentID),
			"WEEKLY_UPDATE":   fmt.Sprintf("Namaskara! Idu RVCE college inda vaara varada update. %s avara haajari mattu result vivaranegalu.", studentID),
			"ASSIGNMENT_MISS": fmt.Sprintf("Namaskara! Idu RVCE college. %s avaru assignment submit maadilla. Dayavittu avara jothe maataadi.", studentID),
			"EXAM_REMINDER":   fmt.Sprintf("Namaskara! Idu RVCE college. %s avaru parikshege register aagilla. Dayavittu sheegra karama tegerikoli.", studentID),
		},
		"hi": {
			"ABSENT_CALL":     fmt.Sprintf("Namaskar! Yeh RVCE college ki taraf se automated call hai. Aapka baccha %s aaj college nahi aaya. Kripaya jankari dijiye.", studentID),
			"FEE_REMINDER":    fmt.Sprintf("Namaskar! Yeh RVCE college accounts se call hai. %s ki fees baaki hai. Kripaya jald bhugtaan karein.", studentID),
			"WEEKLY_UPDATE":   fmt.Sprintf("Namaskar! Yeh RVCE college ki taraf se weekly update hai. %s ki haazri aur result ki jaankari.", studentID),
			"ASSIGNMENT_MISS": fmt.Sprintf("Namaskar! Yeh RVCE college se call hai. %s ne assignment submit nahi kiya. Kripaya unse baat karein.", studentID),
			"EXAM_REMINDER":   fmt.Sprintf("Namaskar! Yeh RVCE college se call hai. %s ki pariksha registration baaki hai. Kripaya jald karein.", studentID),
		},
		"ta": {
			"ABSENT_CALL":     fmt.Sprintf("Vanakkam! Ithu RVCE college irundu automatic call. Ungal paiyan/penn %s inru college varavailla. Thagaval tharungal.", studentID),
			"FEE_REMINDER":    fmt.Sprintf("Vanakkam! RVCE college accounts department irundu call. %s fees nilluvai ullathu. Udan seluththungal.", studentID),
			"WEEKLY_UPDATE":   fmt.Sprintf("Vanakkam! RVCE college irundu weekly update. %s avar varukai matrum marks pattri.", studentID),
			"ASSIGNMENT_MISS": fmt.Sprintf("Vanakkam! RVCE college irundu. %s assignment submit seyavillai. Thayavu seithu paesung.", studentID),
			"EXAM_REMINDER":   fmt.Sprintf("Vanakkam! RVCE college irundu. %s exam registration seyavillai. Udan seyungal.", studentID),
		},
		"te": {
			"ABSENT_CALL":     fmt.Sprintf("Namaskaram! Idi RVCE college nundi automated call. Meeru pillagaadu/pillaga %s indu college ki raaledu. Vivekaalu ivvandi.", studentID),
			"FEE_REMINDER":    fmt.Sprintf("Namaskaram! RVCE college accounts nundi call. %s fees migilipoyindi. Vadanti chadimpandi.", studentID),
			"WEEKLY_UPDATE":   fmt.Sprintf("Namaskaram! RVCE college nundi vaaram update. %s haazri mariyu marks vivekaalu.", studentID),
			"ASSIGNMENT_MISS": fmt.Sprintf("Namaskaram! RVCE college nundi. %s assignment submit cheyyaledu. Vaallanu matladandi.", studentID),
			"EXAM_REMINDER":   fmt.Sprintf("Namaskaram! RVCE college nundi. %s exam registration cheyyaledu. Vadanti chesukokandi.", studentID),
		},
		"en": {
			"ABSENT_CALL":     fmt.Sprintf("Hello! This is an automated call from RVCE college. Your child %s was absent today. Please let us know if there is any concern.", studentID),
			"FEE_REMINDER":    fmt.Sprintf("Hello! This is RVCE college accounts department. The fee for student %s is pending. Please clear it at the earliest.", studentID),
			"WEEKLY_UPDATE":   fmt.Sprintf("Hello! This is a weekly update from RVCE college regarding student %s attendance and academic progress.", studentID),
			"ASSIGNMENT_MISS": fmt.Sprintf("Hello! This is RVCE college. Student %s has not submitted their assignment. Please speak to them.", studentID),
			"EXAM_REMINDER":   fmt.Sprintf("Hello! This is RVCE college. Student %s has not completed exam registration. Please do it at the earliest.", studentID),
		},
	}
	if langScripts, ok := scripts[lang]; ok {
		if script, ok := langScripts[callType]; ok {
			return script
		}
		return langScripts["ABSENT_CALL"]
	}
	return scripts["en"]["ABSENT_CALL"]
}
