"""EdAI AI Engine — FastAPI entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routers import asr, tts, nmt, llm, health

app = FastAPI(
    title="EdAI AI Engine",
    description="ASR · TTS · NMT · LLM orchestration for EdAI voice and chatbot features",
    version="1.0.0",
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
