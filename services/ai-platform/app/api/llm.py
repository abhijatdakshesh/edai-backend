"""
LLM orchestration endpoint.
Production: routes through LiteLLM to Anthropic / local model.
Generates call scripts and post-call summaries for the parent voice agent.
"""

from fastapi import APIRouter
from app.models.schemas import LlmRequest, LlmResponse

router = APIRouter(tags=["LLM"])

TASK_TEMPLATES = {
    "absence_notification": (
        "You are calling the parent of student {student_id} to notify them of an absence. "
        "Context: {context}. Generate a warm, concise call script in {language}."
    ),
    "at_risk_alert": (
        "The student {student_id} is academically at risk. Context: {context}. "
        "Generate a supportive call script for the parent in {language}."
    ),
}


@router.post("/orchestrate", response_model=LlmResponse)
async def orchestrate(payload: LlmRequest) -> LlmResponse:
    template = TASK_TEMPLATES.get(payload.task, TASK_TEMPLATES["absence_notification"])
    prompt = template.format(
        student_id=payload.student_id,
        context=payload.context,
        language=payload.language,
    )
    # TODO: call ANTHROPIC_API_KEY via LiteLLM at LITELLM_BASE_URL
    return LlmResponse(
        summary=f"Automated summary for student {payload.student_id}",
        script=f"[Stub {payload.language} call script] {prompt[:80]}...",
        language=payload.language,
    )
