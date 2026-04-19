from fastapi import APIRouter
from src.models.schemas import NmtRequest, NmtResponse
from src.services import nmt_service

router = APIRouter(tags=["NMT"])


@router.post("/translate", response_model=NmtResponse)
async def translate(payload: NmtRequest) -> NmtResponse:
    return await nmt_service.translate(payload.text, payload.source_lang, payload.target_lang)
