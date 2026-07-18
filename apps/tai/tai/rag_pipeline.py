from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Protocol

from tai.context_assembly import CitationValidator, ContextAssembler, GroundedContext
from tai.model_runtime import ModelGenerationResult, ModelInvocationAttempt
from tai.retrieval_service import RetrievalResponse, RetrievalService


class GroundedAnswerStatus(StrEnum):
    ANSWERED = "ANSWERED"
    ABSTAINED = "ABSTAINED"
    REJECTED = "REJECTED"


@dataclass(frozen=True, slots=True)
class GroundedAnswerPolicy:
    maximum_output_chars: int = 8_000
    minimum_trust_score: float = 0.5
    citations_required: bool = True

    def __post_init__(self) -> None:
        if self.maximum_output_chars < 128 or self.maximum_output_chars > 100_000:
            raise ValueError("maximum_output_chars must be between 128 and 100000")
        if not 0.0 <= self.minimum_trust_score <= 1.0:
            raise ValueError("minimum_trust_score must be between 0 and 1")


@dataclass(frozen=True, slots=True)
class GroundedAnswerRequest:
    request_id: str
    question: str
    tenant_id: str | None
    requested_at: datetime

    def __post_init__(self) -> None:
        if not self.request_id.strip():
            raise ValueError("request_id must not be blank")
        if not self.question.strip():
            raise ValueError("question must not be blank")
        if self.tenant_id is not None and not self.tenant_id.strip():
            raise ValueError("tenant_id must be null or non-blank")


@dataclass(frozen=True, slots=True)
class GroundedAnswerTrace:
    request_id: str
    tenant_id: str | None
    status: GroundedAnswerStatus
    model_id: str
    model_revision: str | None
    model_route_id: str | None
    model_attempts: tuple[ModelInvocationAttempt, ...]
    model_invoked: bool
    generation: int | None
    query_sha256: str
    context_sha256: str
    answer_sha256: str | None
    chunk_ids: tuple[str, ...]
    source_ids: tuple[str, ...]
    citations: tuple[str, ...]
    reason: str | None
    completed_at: datetime


@dataclass(frozen=True, slots=True)
class GroundedAnswerResponse:
    status: GroundedAnswerStatus
    answer: str | None
    retrieval: RetrievalResponse
    context: GroundedContext
    trace: GroundedAnswerTrace


class LocalModelGateway(Protocol):
    def generate(
        self,
        prompt: str,
        *,
        request_id: str,
        now: datetime,
        maximum_output_chars: int,
    ) -> ModelGenerationResult: ...


class GroundedAnswerAuditSink(Protocol):
    def record(self, trace: GroundedAnswerTrace) -> None: ...


class NullGroundedAnswerAuditSink:
    def record(self, trace: GroundedAnswerTrace) -> None:
        del trace


class GroundedRAGPipeline:
    """Orchestrate retrieval, context assembly, local generation, and grounding gates."""

    def __init__(
        self,
        *,
        retrieval_service: RetrievalService,
        context_assembler: ContextAssembler,
        model_gateway: LocalModelGateway,
        audit_sink: GroundedAnswerAuditSink | None = None,
        policy: GroundedAnswerPolicy | None = None,
    ) -> None:
        self._retrieval_service = retrieval_service
        self._context_assembler = context_assembler
        self._model_gateway = model_gateway
        self._audit_sink = audit_sink or NullGroundedAnswerAuditSink()
        self._policy = policy or GroundedAnswerPolicy()
        self._citation_validator = CitationValidator()

    def answer(self, request: GroundedAnswerRequest) -> GroundedAnswerResponse:
        retrieval = self._retrieval_service.retrieve(
            request_id=request.request_id,
            text=request.question,
            tenant_id=request.tenant_id,
            now=request.requested_at,
            minimum_trust_score=self._policy.minimum_trust_score,
        )
        context = self._context_assembler.assemble(
            retrieval,
            assembled_at=request.requested_at,
        )
        if not context.blocks:
            return self._finalize(
                request=request,
                retrieval=retrieval,
                context=context,
                status=GroundedAnswerStatus.ABSTAINED,
                answer=None,
                model_invoked=False,
                model_generation=None,
                citations=(),
                reason="no eligible evidence was retrieved",
            )

        prompt = _build_prompt(request.question, context)
        try:
            model_generation = self._model_gateway.generate(
                prompt,
                request_id=request.request_id,
                now=request.requested_at,
                maximum_output_chars=self._policy.maximum_output_chars,
            )
        except Exception:
            return self._finalize(
                request=request,
                retrieval=retrieval,
                context=context,
                status=GroundedAnswerStatus.ABSTAINED,
                answer=None,
                model_invoked=True,
                model_generation=None,
                citations=(),
                reason="local model runtime was unavailable",
            )

        generated = model_generation.text.strip()
        if not generated:
            return self._finalize(
                request=request,
                retrieval=retrieval,
                context=context,
                status=GroundedAnswerStatus.ABSTAINED,
                answer=None,
                model_invoked=True,
                model_generation=model_generation,
                citations=(),
                reason="local model returned an empty answer",
            )
        if len(generated) > self._policy.maximum_output_chars:
            return self._finalize(
                request=request,
                retrieval=retrieval,
                context=context,
                status=GroundedAnswerStatus.REJECTED,
                answer=None,
                model_invoked=True,
                model_generation=model_generation,
                citations=(),
                reason="local model exceeded the output budget",
            )

        validation = self._citation_validator.validate(
            generated,
            context,
            citations_required=self._policy.citations_required,
        )
        if not validation.valid:
            return self._finalize(
                request=request,
                retrieval=retrieval,
                context=context,
                status=GroundedAnswerStatus.REJECTED,
                answer=None,
                model_invoked=True,
                model_generation=model_generation,
                citations=validation.cited_ids,
                reason=validation.reason,
            )
        return self._finalize(
            request=request,
            retrieval=retrieval,
            context=context,
            status=GroundedAnswerStatus.ANSWERED,
            answer=generated,
            model_invoked=True,
            model_generation=model_generation,
            citations=validation.cited_ids,
            reason=None,
        )

    def _finalize(
        self,
        *,
        request: GroundedAnswerRequest,
        retrieval: RetrievalResponse,
        context: GroundedContext,
        status: GroundedAnswerStatus,
        answer: str | None,
        model_invoked: bool,
        model_generation: ModelGenerationResult | None,
        citations: tuple[str, ...],
        reason: str | None,
    ) -> GroundedAnswerResponse:
        model_id = (
            model_generation.model_id
            if model_generation is not None
            else ("unrouted" if model_invoked else "not-invoked")
        )
        trace = GroundedAnswerTrace(
            request_id=request.request_id.strip(),
            tenant_id=None if request.tenant_id is None else request.tenant_id.strip(),
            status=status,
            model_id=model_id,
            model_revision=(
                None if model_generation is None else model_generation.revision
            ),
            model_route_id=(
                None if model_generation is None else model_generation.route_id
            ),
            model_attempts=(
                () if model_generation is None else model_generation.attempts
            ),
            model_invoked=model_invoked,
            generation=retrieval.evidence.generation,
            query_sha256=retrieval.evidence.query_sha256,
            context_sha256=context.evidence.context_sha256,
            answer_sha256=(
                None if answer is None else hashlib.sha256(answer.encode()).hexdigest()
            ),
            chunk_ids=context.evidence.chunk_ids,
            source_ids=context.evidence.source_ids,
            citations=citations,
            reason=reason,
            completed_at=request.requested_at,
        )
        self._audit_sink.record(trace)
        return GroundedAnswerResponse(
            status=status,
            answer=answer,
            retrieval=retrieval,
            context=context,
            trace=trace,
        )


def _build_prompt(question: str, context: GroundedContext) -> str:
    sanitized_question = (
        question.replace("\x00", "")
        .replace("</question>", "&lt;/question&gt;")
        .strip()
    )
    return "\n".join(
        (
            "You are Transparent Agro Intelligence.",
            "Answer only from the supplied evidence.",
            "Do not infer authoritative Deal, money, role, document, or dispute state.",
            "Cite every material claim with [S<number>].",
            "When evidence is insufficient, state that the answer cannot be confirmed.",
            context.prompt_fragment,
            "<question>",
            sanitized_question,
            "</question>",
        )
    )
