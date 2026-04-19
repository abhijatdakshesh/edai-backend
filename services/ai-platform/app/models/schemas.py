from pydantic import BaseModel


class AsrRequest(BaseModel):
    audio_url: str
    language: str = "kn"
    sample_rate: int = 16000


class AsrResponse(BaseModel):
    transcript: str
    language: str
    confidence: float


class TtsRequest(BaseModel):
    text: str
    language: str = "kn"
    voice: str = "female"


class TtsResponse(BaseModel):
    audio_url: str
    duration_seconds: float


class NmtRequest(BaseModel):
    text: str
    source_language: str = "en"
    target_language: str = "kn"


class NmtResponse(BaseModel):
    translated_text: str
    source_language: str
    target_language: str


class LlmRequest(BaseModel):
    context: str
    student_id: str
    language: str = "kn"
    task: str = "absence_notification"


class LlmResponse(BaseModel):
    summary: str
    script: str
    language: str
