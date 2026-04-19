from fastapi import APIRouter
from src.models.schemas import (
    ChatRequest, ChatResponse,
    DialogueTurnRequest, DialogueTurnResponse,
    IncidentClassifyRequest, IncidentClassifyResponse,
    SummariseCallRequest, SummariseCallResponse,
)
from src.services import llm_service

router = APIRouter(tags=["LLM"])


@router.post("/dialogue-turn", response_model=DialogueTurnResponse)
async def dialogue_turn(payload: DialogueTurnRequest) -> DialogueTurnResponse:
    return await llm_service.dialogue_turn(payload)


@router.post("/summarise-call", response_model=SummariseCallResponse)
async def summarise_call(payload: SummariseCallRequest) -> SummariseCallResponse:
    return await llm_service.summarise_call(payload)


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    return await llm_service.chat(payload)


@router.post("/classify-incident", response_model=IncidentClassifyResponse)
async def classify_incident(payload: IncidentClassifyRequest) -> IncidentClassifyResponse:
    return await llm_service.classify_incident(payload)
