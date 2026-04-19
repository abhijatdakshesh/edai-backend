"""
NMT (Neural Machine Translation) endpoint.
Production: calls Bhashini / AI4Bharat IndicTrans2 API.
"""

from fastapi import APIRouter
from app.models.schemas import NmtRequest, NmtResponse

router = APIRouter(tags=["NMT"])


@router.post("/translate", response_model=NmtResponse)
async def translate(payload: NmtRequest) -> NmtResponse:
    # TODO: call BHASHINI_API_KEY NMT endpoint
    return NmtResponse(
        translated_text=f"[{payload.target_language} translation of: {payload.text}]",
        source_language=payload.source_language,
        target_language=payload.target_language,
    )
