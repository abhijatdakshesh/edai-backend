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

// PlayAndGather plays an audio URL then waits for DTMF input.
// Does NOT modify the existing SayAndGather function.
func PlayAndGather(audioURL, dtmfAction string, numDigits, timeout int) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?><Response><Gather action="%s" method="POST" numDigits="%d" timeout="%d"><Play>%s</Play></Gather></Response>`,
		dtmfAction, numDigits, timeout, audioURL)
}

// PlayAndHangup plays an audio URL then hangs up.
// Does NOT modify the existing SayAndHangup function.
func PlayAndHangup(audioURL string) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?><Response><Play>%s</Play><Hangup/></Response>`, audioURL)
}

// OpeningScript returns the greeting + IVR menu for each language and call type.
func OpeningScript(lang, callType, studentName string) string {
	menu := map[string]string{
		"kn": " 1 annu press maadi acknowledge maadalu. 2 annu press maadi avaru unwell iddare maahiti nidi. 3 annu press maadi teacher jothe maataadi. 9 annu press maadi calls nilu madalu.",
		"hi": " 1 dabayen acknowledge karne ke liye. 2 dabayen agar woh bimaar hain. 3 dabayen teacher se baat karne ke liye. 9 dabayen calls band karne ke liye.",
		"ta": " 1 anukku press pannungal eppadi confirm pannanum. 2 anukku press pannungal unwell endraal. 3 anukku press pannungal teacher paesha. 9 anukku press pannungal calls nilaikka.",
		"te": " 1 press cheyyandi acknowledge chesukovalante. 2 press cheyyandi vaariki unwell aithe. 3 press cheyyandi teacher tho matladaniki. 9 press cheyyandi calls aapukovalante.",
		"en": " Press 1 to acknowledge. Press 2 if your child is unwell. Press 3 to request a teacher callback. Press 9 to stop these calls.",
	}
	m := menu[lang]
	if m == "" {
		m = menu["en"]
	}
	scripts := map[string]map[string]string{
		"kn": {
			"ABSENT_CALL":     fmt.Sprintf("Namaskara! Idu RVCE college inda swayanchalita kareya aagide. Nimma magu %s indu college ge baralilla.%s", studentName, m),
			"FEE_REMINDER":    fmt.Sprintf("Namaskara! Idu RVCE college accounts vibhaga. %s avara fee payment baaki ide.%s", studentName, m),
			"WEEKLY_UPDATE":   fmt.Sprintf("Namaskara! Idu RVCE college inda vaara varada update. %s avara haajari mattu result vivaranegalu.%s", studentName, m),
			"ASSIGNMENT_MISS": fmt.Sprintf("Namaskara! Idu RVCE college. %s avaru assignment submit maadilla.%s", studentName, m),
			"EXAM_REMINDER":   fmt.Sprintf("Namaskara! Idu RVCE college. %s avaru parikshege register aagilla.%s", studentName, m),
		},
		"hi": {
			"ABSENT_CALL":     fmt.Sprintf("Namaskar! Yeh RVCE college ki taraf se call hai. Aapka baccha %s aaj college nahi aaya.%s", studentName, m),
			"FEE_REMINDER":    fmt.Sprintf("Namaskar! Yeh RVCE college accounts se call hai. %s ki fees baaki hai.%s", studentName, m),
			"WEEKLY_UPDATE":   fmt.Sprintf("Namaskar! RVCE college ki taraf se weekly update. %s ki haazri aur result ki jaankari.%s", studentName, m),
			"ASSIGNMENT_MISS": fmt.Sprintf("Namaskar! Yeh RVCE college se call hai. %s ne assignment submit nahi kiya.%s", studentName, m),
			"EXAM_REMINDER":   fmt.Sprintf("Namaskar! Yeh RVCE college se call hai. %s ki pariksha registration baaki hai.%s", studentName, m),
		},
		"ta": {
			"ABSENT_CALL":     fmt.Sprintf("Vanakkam! Ithu RVCE college irundu call. Ungal %s inru college varavailla.%s", studentName, m),
			"FEE_REMINDER":    fmt.Sprintf("Vanakkam! RVCE college accounts irundu call. %s fees nilluvai ullathu.%s", studentName, m),
			"WEEKLY_UPDATE":   fmt.Sprintf("Vanakkam! RVCE college irundu weekly update. %s varukai matrum marks pattri.%s", studentName, m),
			"ASSIGNMENT_MISS": fmt.Sprintf("Vanakkam! RVCE college irundu. %s assignment submit seyavillai.%s", studentName, m),
			"EXAM_REMINDER":   fmt.Sprintf("Vanakkam! RVCE college irundu. %s exam registration seyavillai.%s", studentName, m),
		},
		"te": {
			"ABSENT_CALL":     fmt.Sprintf("Namaskaram! Idi RVCE college nundi call. %s indu college ki raaledu.%s", studentName, m),
			"FEE_REMINDER":    fmt.Sprintf("Namaskaram! RVCE college accounts nundi call. %s fees migilipoyindi.%s", studentName, m),
			"WEEKLY_UPDATE":   fmt.Sprintf("Namaskaram! RVCE college nundi vaaram update. %s haazri mariyu marks vivekaalu.%s", studentName, m),
			"ASSIGNMENT_MISS": fmt.Sprintf("Namaskaram! RVCE college nundi. %s assignment submit cheyyaledu.%s", studentName, m),
			"EXAM_REMINDER":   fmt.Sprintf("Namaskaram! RVCE college nundi. %s exam registration cheyyaledu.%s", studentName, m),
		},
		"en": {
			"ABSENT_CALL":     fmt.Sprintf("Hello! This is an automated call from RVCE college. Your child %s was absent today.%s", studentName, m),
			"FEE_REMINDER":    fmt.Sprintf("Hello! This is RVCE college accounts. The fee for %s is pending.%s", studentName, m),
			"WEEKLY_UPDATE":   fmt.Sprintf("Hello! This is a weekly update from RVCE college for student %s.%s", studentName, m),
			"ASSIGNMENT_MISS": fmt.Sprintf("Hello! This is RVCE college. %s has not submitted their assignment.%s", studentName, m),
			"EXAM_REMINDER":   fmt.Sprintf("Hello! This is RVCE college. %s has not completed exam registration.%s", studentName, m),
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

// ResponseScript returns the spoken reply for a detected parent intent.
func ResponseScript(lang, intent string) string {
	scripts := map[string]map[string]string{
		"kn": {
			"ACK":         "Dhanyavaadagalu. Nimma maahiti tegerekondideevi. Shubhadinavanagali.",
			"SICK":        "Artha aagide. Avaru bega gungaavaagali. Avaru college ge bandamele medical certificate tanni. Dhanyavaadagalu.",
			"CALLBACK":    "Nimma korekennu sveekarisiddive. Ondhu teacher sheegradalli nimagu call maaduttaare. Dhanyavaadagalu.",
			"GOODBYE":     "Nimma samayakke dhanyavaadagalu. Shubhadinavanagali.",
			"UNSUBSCRIBE": "Nimmannu automated calls ninda hatiyalaagide. Dhanyavaadagalu.",
		},
		"hi": {
			"ACK":         "Shukriya. Aapki jaankari hamare paas aa gayi. Aapka din achha rahe.",
			"SICK":        "Samajh gaye. Jaldi theek hon ki shubhkamnaen. Wapas aane par medical certificate zaroor layen.",
			"CALLBACK":    "Aapka request mila. Ek teacher jald hi aapko call karenge. Shukriya.",
			"GOODBYE":     "Samay dene ka shukriya. Namaste.",
			"UNSUBSCRIBE": "Aapko automated calls se hata diya gaya hai. Shukriya.",
		},
		"ta": {
			"ACK":         "Nandri. Ungal thakaval pethirukkom. Nalla naal vaazhthukal.",
			"SICK":        "Purinthukonden. Vithaiyai vilainthukolkiren. Thirumba varum podhu medical certificate konduvaarunga.",
			"CALLBACK":    "Ungal korichchal kidaithathu. Oru teacher vilaivil azhaipaargal. Nandri.",
			"GOODBYE":     "Ungal nerathukku nandri. Nalla naal vaazhthukal.",
			"UNSUBSCRIBE": "Neenga automated calls list-il irunthu neekkappatteerkal. Nandri.",
		},
		"te": {
			"ACK":         "Dhanyavaadaalu. Meeru vivaraalu andayi. Manchidi jarugugunugaaka.",
			"SICK":        "Artham chesukunnanu. Vaariki tvaraga kover kaavaali. Thirigi vastinapudu medical certificate teecchaali.",
			"CALLBACK":    "Meeru request andindi. Oka teacher vinaadilo call chesthaaru. Dhanyavaadaalu.",
			"GOODBYE":     "Meeru samayaanki dhanyavaadaalu. Manchidi jarugugunugaaka.",
			"UNSUBSCRIBE": "Meerunu automated calls nundi teesiveyabadindi. Dhanyavaadaalu.",
		},
		"en": {
			"ACK":         "Thank you. We have noted your acknowledgement. Have a great day.",
			"SICK":        "Understood. We hope your child recovers soon. Please bring a medical certificate when they return.",
			"CALLBACK":    "Your request has been noted. A teacher will call you back shortly. Thank you.",
			"GOODBYE":     "Thank you for your time. Have a great day.",
			"UNSUBSCRIBE": "You have been unsubscribed from automated calls. Goodbye.",
		},
	}
	if langScripts, ok := scripts[lang]; ok {
		if s, ok := langScripts[intent]; ok {
			return s
		}
		return langScripts["GOODBYE"]
	}
	return scripts["en"]["GOODBYE"]
}
