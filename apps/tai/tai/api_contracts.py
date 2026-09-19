from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from tai.contracts import ToolMode
from tai.orchestration import OrchestrationStatus


class AssistantAnswerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: str = Field(min_length=1, max_length=160, pattern=r"^[A-Za-z0-9._:-]+$")
    question: str = Field(min_length=2, max_length=8_000)
    locale: Literal["ru", "en", "zh"] = "ru"
    deadline_ms: int = Field(default=60_000, ge=1_000, le=90_000)


class CitationContract(BaseModel):
    model_config = ConfigDict(extra="forbid")

    citation_id: str
    source_id: str
    chunk_id: str
    generation: int
    trust_score: float = Field(ge=0, le=1)


class ToolConfirmationContract(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirmation_id: UUID
    call_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._:-]+$")
    request_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    user_id: UUID
    tenant_id: UUID | None
    session_id: UUID
    issued_at: datetime
    expires_at: datetime
    mfa_verified: bool
    signature_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class PreparedActionContract(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trace_id: UUID
    plan_id: UUID
    call_id: str
    tool_name: str
    mode: ToolMode
    arguments: dict[str, Any]
    confirmation: ToolConfirmationContract


class ToolCallResultContract(BaseModel):
    model_config = ConfigDict(extra="forbid")

    call_id: str
    tool_name: str
    mode: ToolMode
    status: str
    result: dict[str, Any] | None
    result_sha256: str | None
    reason: str | None


class ToolExecutionContract(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan_id: UUID
    status: str
    calls: list[ToolCallResultContract]


class AssistantAnswerResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: str = "tai.orchestration.response.v1"
    request_id: str
    trace_id: UUID
    status: OrchestrationStatus
    answer: str | None
    citations: list[CitationContract]
    knowledge_generation: int | None
    model_id: str
    model_revision: str | None
    model_route_id: str | None
    tool_execution: ToolExecutionContract | None
    prepared_actions: list[PreparedActionContract]
    reason: str | None
    completed_at: datetime
    replayed: bool


class AssistantConfirmationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: str = Field(min_length=1, max_length=160, pattern=r"^[A-Za-z0-9._:-]+$")
    explicit_user_confirmation: Literal[True]
    confirmation: ToolConfirmationContract


class AssistantConfirmationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: str = "tai.confirmation.response.v1"
    request_id: str
    trace_id: UUID
    plan_id: UUID
    status: str
    calls: list[ToolCallResultContract]
    completed_at: datetime


class APIErrorContract(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: str = "tai.error.v1"
    error_id: UUID
    request_id: str | None
    code: str
    message: str
    retryable: bool
    retry_after_seconds: int | None = None
