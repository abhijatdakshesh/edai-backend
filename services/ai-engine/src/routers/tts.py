from fastapi import APIRouter
from src.models.schemas import TtsRequest, TtsResponse
from src.services import tts_service

router = APIRouter(tags=["TTS"])


@router.post("/synthesise", response_model=TtsResponse)
async def synthesise(payload: TtsRequest) -> TtsResponse:
    return await tts_service.synthesise(payload.text, payload.language, payload.gender, payload.speed)
