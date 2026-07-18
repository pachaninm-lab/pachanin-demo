from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class AnswerType(StrEnum):
    FACT = "FACT"
    RULE = "RULE"
    CALCULATION = "CALCULATION"
    FORECAST = "FORECAST"
    RECOMMENDATION = "RECOMMENDATION"
    SUMMARY = "SUMMARY"


class RiskLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ToolMode(StrEnum):
    READ_ONLY = "READ_ONLY"
    DRAFT = "DRAFT"
    CONFIRMED_WRITE = "CONFIRMED_WRITE"
    PRIVILEGED_WRITE = "PRIVILEGED_WRITE"
    PROHIBITED = "PROHIBITED"


class SourceRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_id: str
    title: str
    uri: str | None = None
    version: str | None = None
    effective_at: datetime | None = None
    retrieved_at: datetime
    trust_score: float = Field(ge=0, le=1)


class NextAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action_id: str
    title: str
    rationale: str
    tool_name: str | None = None
    tool_mode: ToolMode = ToolMode.READ_ONLY
    requires_confirmation: bool = False


class AIResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: str = "tai.response.v1"
    answer_id: UUID = Field(default_factory=uuid4)
    trace_id: UUID
    answer_type: AnswerType
    direct_answer: str
    grounds: list[str] = Field(default_factory=list)
    sources: list[SourceRef] = Field(default_factory=list)
    freshness_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    confidence: float = Field(ge=0, le=1)
    unknowns: list[str] = Field(default_factory=list)
    risk_level: RiskLevel = RiskLevel.LOW
    next_actions: list[NextAction] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    model_route: str
    knowledge_version: str
    policy_version: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class IdentityContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID
    tenant_id: UUID | None
    roles: frozenset[str]
    session_id: UUID
    mfa_verified: bool = False
    authenticated: bool = True


class ToolRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trace_id: UUID
    tool_name: str
    arguments: dict[str, Any]
    requested_mode: ToolMode
    justification: str | None = None
    explicit_user_confirmation: bool = False
