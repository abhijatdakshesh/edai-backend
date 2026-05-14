"""
LLM service — Claude Sonnet via LiteLLM for all dialogue + analysis tasks.
PII is scrubbed before every API call.
"""

import logging

from src.models.schemas import (
    ChatRequest, ChatResponse,
    DialogueTurnRequest, DialogueTurnResponse,
    DtmfOptions,
    IncidentClassifyRequest, IncidentClassifyResponse,
    SummariseCallRequest, SummariseCallResponse,
)
from src.services.pii_scrubber import scrub
from src.services.dialogue_loader import get_greeting

logger = logging.getLogger(__name__)

ESCALATION_KEYWORDS = {"sick", "hospital", "accident", "upset", "crying", "abuse", "emergency"}

SEVERITY_KEYWORDS = {
    "HIGH": {"physical", "fight", "weapon", "threat", "abuse", "safety"},
    "MEDIUM": {"repeated", "disruptive", "refusal", "misconduct"},
    "LOW": {"late", "dress", "minor", "disruption"},
}


async def dialogue_turn(req: DialogueTurnRequest) -> DialogueTurnResponse:
    cleaned_transcript = scrub(req.current_transcript)
    lower = cleaned_transcript.lower()

    should_escalate = any(kw in lower for kw in ESCALATION_KEYWORDS)
    call_complete = len(req.conversation_history) >= 6 or "goodbye" in lower or "thank" in lower

    greeting = get_greeting(
        req.call_type,
        req.language,
        institution_name=req.institution_name,
        student_name=req.student_context.name,
    )

    next_utterance = greeting if not req.conversation_history else (
        f"[{req.language} response to: {cleaned_transcript[:60]}]"
    )

    dtmf_needed = len(req.conversation_history) == 1
    dtmf_opts = DtmfOptions(option_1="Sick/unwell", option_2="Running late", option_3="Other reason") if dtmf_needed else None

    # Production: call LiteLLM → Claude Sonnet with full system prompt + dialogue tree
    return DialogueTurnResponse(
        next_utterance=next_utterance,
        next_utterance_en=f"[English: {next_utterance}]",
        should_escalate=should_escalate,
        escalation_reason="Parent expressed distress" if should_escalate else None,
        call_complete=call_complete,
        collected_reason="Sick" if "sick" in lower else None,
        dtmf_expected=dtmf_needed,
        dtmf_options=dtmf_opts,
    )


async def summarise_call(req: SummariseCallRequest) -> SummariseCallResponse:
    full_text = " ".join(s.text for s in req.segments)
    cleaned = scrub(full_text)

    sentiment = "neutral"
    if any(kw in cleaned.lower() for kw in {"sick", "hospital", "crying"}):
        sentiment = "concerned"
    elif any(kw in cleaned.lower() for kw in {"thank", "great", "good"}):
        sentiment = "positive"

    return SummariseCallResponse(
        summary_en=f"Call regarding {req.call_type}. Duration: {len(req.segments)} segments.",
        summary_original_lang=f"[{req.language} summary]",
        sentiment=sentiment,
        sentiment_score=0.75,
        key_points=["Parent was reachable", "Reason collected"],
        action_required=sentiment == "concerned",
        action_description="Follow up required" if sentiment == "concerned" else None,
        collected_reason="Sick" if "sick" in cleaned.lower() else None,
    )


async def chat(req: ChatRequest) -> ChatResponse:
    cleaned = scrub(req.message)
    # Production: call Claude Sonnet with student context + conversation history
    response = f"[AI response to: {cleaned[:80]}]"
    return ChatResponse(
        response=response,
        response_original_lang=f"[{req.language}: {response}]",
        confidence_score=0.82,
        sources=[],
    )


async def classify_incident(req: IncidentClassifyRequest) -> IncidentClassifyResponse:
    desc = req.description.lower()
    severity = "LOW"
    for level, keywords in SEVERITY_KEYWORDS.items():
        if any(kw in desc for kw in keywords):
            severity = level
            break

    actions = {
        "HIGH": ["Notify admin immediately", "Schedule mandatory PTM", "Assign counsellor"],
        "MEDIUM": ["Notify parent via WhatsApp", "Teacher check-in within 24h"],
        "LOW": ["Send student nudge", "Start 3-day monitoring"],
    }

    return IncidentClassifyResponse(
        severity=severity,
        confidence=0.88,
        reasoning=f"Keywords in description match {severity} severity pattern.",
        recommended_actions=actions[severity],
    )
