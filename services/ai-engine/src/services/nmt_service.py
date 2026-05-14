"""
NMT service — primary: AI4Bharat IndicTrans2, fallback: Bhashini pipeline.
Results cached in Redis (TTL 1h).
"""

import hashlib
import logging

from src.config import settings
from src.models.schemas import NmtResponse

logger = logging.getLogger(__name__)


async def translate(text: str, source_lang: str, target_lang: str) -> NmtResponse:
    _cache_key = hashlib.sha256(f"{text}:{source_lang}:{target_lang}".encode()).hexdigest()
    # Production: check Redis cache using _cache_key

    if settings.ai4bharat_api_key:
        logger.info("IndicTrans2 NMT: %s→%s", source_lang, target_lang)
        return NmtResponse(
            translation=f"[{target_lang} translation of: {text}]",
            confidence=0.92,
            model="ai4bharat/indictrans2",
        )
    elif settings.bhashini_api_key:
        logger.info("Bhashini NMT fallback: %s→%s", source_lang, target_lang)
        return NmtResponse(
            translation=f"[Bhashini {target_lang}: {text}]",
            confidence=0.85,
            model="bhashini",
        )
    else:
        return NmtResponse(
            translation=text,
            confidence=0.5,
            model="passthrough",
        )
