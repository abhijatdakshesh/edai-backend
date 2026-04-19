"""ASR router — batch transcription + streaming WebSocket endpoint."""

import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from src.models.schemas import AsrRequest, AsrResponse
from src.services import asr_service

router = APIRouter(tags=["ASR"])


@router.post("/transcribe", response_model=AsrResponse)
async def transcribe(payload: AsrRequest) -> AsrResponse:
    return await asr_service.transcribe(payload.audio_base64, payload.language, payload.format)


@router.websocket("/stream")
async def stream_asr(ws: WebSocket) -> None:
    """
    Streaming ASR over WebSocket.
    Client sends binary audio frames (100ms, 16kHz, 16-bit PCM mono).
    Server emits JSON segments: {type, text, confidence, is_final, speaker}
    """
    await ws.accept()
    buffer: list[bytes] = []
    try:
        while True:
            data = await ws.receive_bytes()
            buffer.append(data)
            if len(buffer) >= 10:  # ~1s of audio
                # Production: stream accumulated buffer to Sarvam/AI4Bharat streaming ASR
                segment = {
                    "type": "segment",
                    "text": "[streaming stub]",
                    "confidence": 0.9,
                    "is_final": True,
                    "speaker": "PARENT",
                }
                await ws.send_text(json.dumps(segment))
                buffer.clear()
    except WebSocketDisconnect:
        pass
