from typing import Optional
from pydantic import BaseModel


# ── ASR ──────────────────────────────────────────────────────────────────────

class AsrRequest(BaseModel):
    audio_base64: str
    language: str = "kn"
    format: str = "wav"


class TranscriptSegment(BaseModel):
    start_ms: int
    end_ms: int
    text: str
    speaker: str = "PARENT"


class AsrResponse(BaseModel):
    transcript: str
    confidence: float
    segments: list[TranscriptSegment]


# ── TTS ──────────────────────────────────────────────────────────────────────

class TtsRequest(BaseModel):
    text: str
    language: str = "kn"
    gender: str = "female"
    speed: float = 1.0


class TtsResponse(BaseModel):
    audio_base64: str
    format: str = "wav"
    duration_ms: int
    sample_rate: int = 16000


# ── NMT ──────────────────────────────────────────────────────────────────────

class NmtRequest(BaseModel):
    text: str
    source_lang: str = "en"
    target_lang: str = "kn"


class NmtResponse(BaseModel):
    translation: str
    confidence: float
    model: str


# ── LLM Dialogue ─────────────────────────────────────────────────────────────

class ConversationTurn(BaseModel):
    speaker: str
    text: str
    timestamp: str


class StudentContext(BaseModel):
    name: str
    class_name: str
    subject: Optional[str] = None
    absence_count: Optional[int] = None
    fee_amount: Optional[float] = None
    assignment: Optional[str] = None


class DialogueTurnRequest(BaseModel):
    call_type: str
    conversation_history: list[ConversationTurn]
    student_context: StudentContext
    institution_name: str
    current_transcript: str
    language: str = "kn"


class DtmfOptions(BaseModel):
    option_1: str
    option_2: str
    option_3: Optional[str] = None


class DialogueTurnResponse(BaseModel):
    next_utterance: str
    next_utterance_en: str
    should_escalate: bool
    escalation_reason: Optional[str] = None
    call_complete: bool
    collected_reason: Optional[str] = None
    dtmf_expected: bool
    dtmf_options: Optional[DtmfOptions] = None


# ── LLM Summarise ─────────────────────────────────────────────────────────────

class SummariseCallRequest(BaseModel):
    segments: list[TranscriptSegment]
    language: str
    call_type: str


class SummariseCallResponse(BaseModel):
    summary_en: str
    summary_original_lang: str
    sentiment: str
    sentiment_score: float
    key_points: list[str]
    action_required: bool
    action_description: Optional[str] = None
    collected_reason: Optional[str] = None


# ── LLM Chat ─────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    user_role: str
    student_context: dict
    conversation_history: list[ChatMessage]
    message: str
    language: str = "en"


class ChatResponse(BaseModel):
    response: str
    response_original_lang: str
    confidence_score: float
    sources: list[str]


# ── LLM Incident Classification ───────────────────────────────────────────────

class IncidentClassifyRequest(BaseModel):
    description: str
    incident_type: str
    student_history: dict


class IncidentClassifyResponse(BaseModel):
    severity: str
    confidence: float
    reasoning: str
    recommended_actions: list[str]
