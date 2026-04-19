"""
ASR (Automatic Speech Recognition) endpoint.
Production: calls Sarvam AI / AI4Bharat Vakyansh API.
"""

from fastapi import APIRouter
from app.models.schemas import AsrRequest, AsrResponse

router = APIRouter(tags=["ASR"])


@router.post("/transcribe", response_model=AsrResponse)
async def transcribe(payload: AsrRequest) -> AsrResponse:
    # TODO: call SARVAM_API_KEY / AI4BHARAT_API_KEY endpoint with payload.audio_url
    return AsrResponse(
        transcript=f"[stub transcript for {payload.audio_url}]",
        language=payload.language,
        confidence=0.95,
    )
