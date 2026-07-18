from uuid import UUID

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from .contracts import AIResponse
from .expert import GroundingError, PlatformQuestion, answer_platform_question

app = FastAPI(title="Transparent Agro Intelligence", version="0.2.0")


class PlatformAnswerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=2, max_length=2000)


@app.get("/health/live")
def liveness() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def readiness() -> dict[str, str]:
    return {
        "status": "ready",
        "policy": "deny-by-default",
        "billing": "disabled-by-architecture",
        "knowledge": "platform-knowledge.2026-07-18.1",
    }


@app.post("/v1/platform/answer", response_model=AIResponse)
def platform_answer(
    payload: PlatformAnswerRequest,
    x_tenant_id: UUID | None = Header(default=None),
) -> AIResponse:
    try:
        return answer_platform_question(
            PlatformQuestion(question=payload.question, tenant_id=x_tenant_id)
        )
    except GroundingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
