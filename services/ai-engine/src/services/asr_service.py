"""
ASR service — routes to Sarvam, AI4Bharat, or OpenAI Whisper based on language.
"""

import base64
import logging

import httpx

from src.config import settings
from src.models.schemas import AsrResponse, TranscriptSegment

logger = logging.getLogger(__name__)

SARVAM_LANGUAGES = {"kn", "hi"}
AI4BHARAT_LANGUAGES = {"ta", "te", "ml"}


async def transcribe(audio_base64: str, language: str, fmt: str) -> AsrResponse:
    if language in SARVAM_LANGUAGES and settings.sarvam_api_key:
        return await _sarvam_transcribe(audio_base64, language, fmt)
    elif language in AI4BHARAT_LANGUAGES and settings.ai4bharat_api_key:
        return await _ai4bharat_transcribe(audio_base64, language, fmt)
    else:
        return await _whisper_transcribe(audio_base64, language, fmt)


async def _sarvam_transcribe(audio_base64: str, language: str, fmt: str) -> AsrResponse:
    # Production: POST https://api.sarvam.ai/speech-to-text
    logger.info("Sarvam ASR: language=%s", language)
    return _stub_response(language)


async def _ai4bharat_transcribe(audio_base64: str, language: str, fmt: str) -> AsrResponse:
    logger.info("AI4Bharat ASR: language=%s", language)
    return _stub_response(language)


async def _whisper_transcribe(audio_base64: str, language: str, fmt: str) -> AsrResponse:
    logger.info("Whisper ASR fallback: language=%s", language)
    return _stub_response(language)


def _stub_response(language: str) -> AsrResponse:
    return AsrResponse(
        transcript=f"[Stub transcript in {language}]",
        confidence=0.95,
        segments=[
            TranscriptSegment(start_ms=0, end_ms=2000, text=f"[Stub in {language}]", speaker="PARENT")
        ],
    )
