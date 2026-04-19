/**
 * Seed notification templates for all channels and 6 languages.
 * Run once on service startup or via migration.
 */

export const NOTIFICATION_TEMPLATES = [
  // ── ABSENT_CALL_SUMMARY ─────────────────────────────────────────────────
  {
    code: 'ABSENT_CALL_SUMMARY',
    channel: 'WHATSAPP',
    language: 'en',
    bodyTemplate:
      'Dear {{parent_name}}, {{student_name}} was absent today. Reason given: {{reason}}. Summary: {{summary}}.',
  },
  {
    code: 'ABSENT_CALL_SUMMARY',
    channel: 'WHATSAPP',
    language: 'kn',
    bodyTemplate:
      'ಪ್ರಿಯ {{parent_name}}, {{student_name}} ಇಂದು ಗೈರಾಗಿದ್ದರು. ಕಾರಣ: {{reason}}. ಸಾರಾಂಶ: {{summary}}.',
  },
  {
    code: 'ABSENT_CALL_SUMMARY',
    channel: 'WHATSAPP',
    language: 'hi',
    bodyTemplate:
      'प्रिय {{parent_name}}, {{student_name}} आज अनुपस्थित था/थी। कारण: {{reason}}। सारांश: {{summary}}।',
  },
  {
    code: 'ABSENT_CALL_SUMMARY',
    channel: 'WHATSAPP',
    language: 'ta',
    bodyTemplate:
      'அன்புள்ள {{parent_name}}, {{student_name}} இன்று வகுப்பில் இல்லை. காரணம்: {{reason}}. சுருக்கம்: {{summary}}.',
  },
  {
    code: 'ABSENT_CALL_SUMMARY',
    channel: 'WHATSAPP',
    language: 'te',
    bodyTemplate:
      'ప్రియమైన {{parent_name}}, {{student_name}} ఈరోజు హాజరు కాలేదు. కారణం: {{reason}}. సారాంశం: {{summary}}.',
  },
  {
    code: 'ABSENT_CALL_SUMMARY',
    channel: 'WHATSAPP',
    language: 'ml',
    bodyTemplate:
      'പ്രിയ {{parent_name}}, {{student_name}} ഇന്ന് ഹാജരായില്ല. കാരണം: {{reason}}. സംഗ്രഹം: {{summary}}.',
  },

  // ── ASSIGNMENT_MISSED_REMINDER ──────────────────────────────────────────
  {
    code: 'ASSIGNMENT_MISSED_REMINDER',
    channel: 'WHATSAPP',
    language: 'en',
    bodyTemplate:
      '{{student_name}} has not submitted {{assignment_name}} due on {{date}}. This carries {{weightage}}% marks. Please ensure completion by {{deadline}}.',
  },

  // ── FEE_REMINDER ────────────────────────────────────────────────────────
  {
    code: 'FEE_REMINDER',
    channel: 'WHATSAPP',
    language: 'en',
    bodyTemplate:
      'Fee of ₹{{amount}} for {{student_name}} is due on {{due_date}}. Pay online: {{payment_link}}. Late charges of ₹{{late_fee}}/day apply after {{due_date}}.',
  },
  {
    code: 'FEE_REMINDER',
    channel: 'SMS',
    language: 'en',
    bodyTemplate:
      'Fee ₹{{amount}} due {{due_date}} for {{student_name}}. Pay: {{payment_link}}. Late charge ₹{{late_fee}}/day.',
  },

  // ── WEEKLY_UPDATE_POSITIVE ──────────────────────────────────────────────
  {
    code: 'WEEKLY_UPDATE_POSITIVE',
    channel: 'WHATSAPP',
    language: 'en',
    bodyTemplate:
      'Great news about {{student_name}} this week!\nAttendance: {{attendance}}% ✓\n{{positive_highlights}}\nKeep encouraging this wonderful momentum!',
  },

  // ── WEEKLY_UPDATE_CONCERN ───────────────────────────────────────────────
  {
    code: 'WEEKLY_UPDATE_CONCERN',
    channel: 'WHATSAPP',
    language: 'en',
    bodyTemplate:
      'Weekly update about {{student_name}}.\nAttendance: {{attendance}}%\n{{concern_summary}}\nAction taken: {{action}}\nResources: {{links}}',
  },

  // ── BEHAVIORAL_ALERT ────────────────────────────────────────────────────
  {
    code: 'BEHAVIORAL_ALERT',
    channel: 'WHATSAPP',
    language: 'en',
    bodyTemplate:
      'Dear {{parent_name}}, a behavioral incident was reported for {{student_name}} today. Severity: {{severity}}. Please contact the class teacher for details.',
  },
];
