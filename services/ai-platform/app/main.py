"""
RV Trust AI Platform — FastAPI service.
Handles ASR, TTS, NMT, and LLM orchestration for the parent voice agent.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import asr, tts, nmt, llm, health

app = FastAPI(
    title="RV Trust AI Platform",
    description="ASR · TTS · NMT · LLM orchestration for the RV Trust parent voice agent",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(asr.router, prefix="/asr")
app.include_router(tts.router, prefix="/tts")
app.include_router(nmt.router, prefix="/nmt")
app.include_router(llm.router, prefix="/llm")
