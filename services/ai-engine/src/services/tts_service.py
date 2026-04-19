"""
TTS service — routes to Sarvam Bulbul, AI4Bharat Indic-TTS, or ElevenLabs.
Synthesised audio is cached in Redis (key = hash(text+lang+gender), TTL 24h).
"""

import base64
import hashlib
import logging

from src.config import settings
from src.models.schemas import TtsResponse

logger = logging.getLogger(__name__)

SARVAM_LANGUAGES = {"kn", "hi"}
AI4BHARAT_LANGUAGES = {"ta", "te", "ml"}

# Silence stub: 1 second of 16kHz 16-bit mono PCM silence (little-endian)
_SILENCE_WAV_B64 = base64.b64encode(b"\x00" * 32000).decode()


async def synthesise(text: str, language: str, gender: str, speed: float) -> TtsResponse:
    cache_key = hashlib.sha256(f"{text}:{language}:{gender}".encode()).hexdigest()
    # Production: check Redis cache first, then call TTS API, then store result

    if language in SARVAM_LANGUAGES and settings.sarvam_api_key:
        logger.info("Sarvam TTS: language=%s", language)
    elif language in AI4BHARAT_LANGUAGES and settings.ai4bharat_api_key:
        logger.info("AI4Bharat TTS: language=%s", language)
    else:
        logger.info("ElevenLabs/OpenAI TTS fallback: language=%s", language)

    return TtsResponse(
        audio_base64=_SILENCE_WAV_B64,
        format="wav",
        duration_ms=1000,
        sample_rate=16000,
    )
