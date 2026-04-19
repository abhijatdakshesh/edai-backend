"""
TTS (Text-to-Speech) endpoint.
Production: calls Sarvam / Bhashini TTS API and stores audio in S3.
"""

import uuid
from fastapi import APIRouter
from app.models.schemas import TtsRequest, TtsResponse

router = APIRouter(tags=["TTS"])


@router.post("/synthesize", response_model=TtsResponse)
async def synthesize(payload: TtsRequest) -> TtsResponse:
    # TODO: call TTS API, upload result to S3, return pre-signed URL
    audio_key = f"{payload.language}/{uuid.uuid4()}.wav"
    return TtsResponse(
        audio_url=f"s3://rvtrust-recordings/{audio_key}",
        duration_seconds=3.5,
    )
