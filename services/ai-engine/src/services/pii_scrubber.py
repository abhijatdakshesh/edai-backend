"""
PII scrubber — removes phone numbers, Aadhaar patterns, and names before sending
text to external LLM APIs. Critical for DPDP compliance.
"""

import re

# Patterns to scrub
_PHONE = re.compile(r"\b(?:\+91[\-\s]?)?[6-9]\d{9}\b")
_AADHAAR = re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")
_PAN = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")
_EMAIL = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")


def scrub(text: str) -> str:
    """Replace PII patterns with placeholder tokens."""
    text = _PHONE.sub("[PHONE]", text)
    text = _AADHAAR.sub("[AADHAAR]", text)
    text = _PAN.sub("[PAN]", text)
    text = _EMAIL.sub("[EMAIL]", text)
    return text
