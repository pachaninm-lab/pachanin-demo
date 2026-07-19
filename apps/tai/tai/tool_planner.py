from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Protocol
from uuid import NAMESPACE_URL, UUID, uuid5

from tai.agent_runtime import AgentToolPlan, PlannedToolCall
from tai.contracts import IdentityContext, ToolMode
from tai.policy import TOOL_REGISTRY

if TYPE_CHECKING:
    from tai.orchestration import OrchestrationRequest
    from tai.rag_pipeline import GroundedAnswerResponse

_CATALOG_VERSION = "tai.tool-catalog.governed.v2"
_PORTABLE = re.compile(r"^[A-Za-z0-9._:-]{1,160}$")
_VERSION = re.compile(r"^(?:0|[1-9][0-9]{0,19})$")
_WHITESPACE = re.compile(r"\s+")
_ASSIGN_LOGISTICS_FIELDS = (
    "carrierOrgId",
    "driverUserId",
    "vehicleId",
    "routeFromFacilityId",
    "routeToFacilityId",
    "expectedUpdatedAt",
    "expectedVersion",
)


class PlannerDecisionStatus(StrEnum):
    SELECTED = "SELECTED"
    NO_MATCH = "NO_MATCH"
    REJECTED = "REJECTED"


@dataclass(frozen=True, slots=True)
class PlannerSelectedCall:
    call_id: str
    tool_name: str
    mode: ToolMode
    arguments_sha256: str


@dataclass(frozen=True, slots=True)
class PlannerDecision:
    trace_id: UUID
    plan_id: UUID
    request_id: str
    tenant_id: UUID | None
    user_id: UUID
    session_id: UUID
    status: PlannerDecisionStatus
    catalog_version: str
    input_sha256: str
    selected_calls: tuple[PlannerSelectedCall, ...]
    reason_codes: tuple[str, ...]
    rejection_signals: tuple[str, ...]
    generated_at: datetime
    decision_sha256: str


class PlannerDecisionSink(Protocol):
    def record(self, decision: PlannerDecision) -> None: ...


class NullPlannerDecisionSink:
    def record(self, decision: PlannerDecision) -> None:
        del decision


@dataclass(frozen=True, slots=True)
class _IntentContract:
    tool_name: str
    mode: ToolMode
    patterns: tuple[re.Pattern[str], ...]


_INTENTS = (
    _IntentContract(
        tool_name="assignLogistics",
        mode=ToolMode.CONFIRMED_WRITE,
        patterns=(
            re.compile(r"\bназнач\w*\s+(?:логистик\w*|перевоз\w*|водител\w*)", re.I),
            re.compile(
                r"\b(?:assign|appoint)\s+(?:the\s+)?"
                r"(?:logistics|carrier|driver|transport)",
                re.I,
            ),
            re.compile(r"(?:分配|指派)(?:物流|承运商|司机)"),
        ),
    ),
    _IntentContract(
        tool_name="prepareCommandDraft",
        mode=ToolMode.DRAFT,
        patterns=(
            re.compile(r"\b(?:подготов\w*|созда\w*|сформиру\w*)\s+черновик\w*", re.I),
            re.compile(r"\b(?:черновик\w*\s+(?:команд\w*|действ\w*))", re.I),
            re.compile(r"\b(?:prepare|create)\s+(?:a\s+)?(?:command\s+)?draft\b", re.I),
            re.compile(r"(?:生成|准备)(?:命令|操作)?草稿"),
        ),
    ),
    _IntentContract(
        tool_name="getRoleNextActions",
        mode=ToolMode.READ_ONLY,
        patterns=(
            re.compile(r"\b(?:что|какие)\s+(?:мне\s+)?(?:делать|действия)\b", re.I),
            re.compile(r"\b(?:следующ\w*|ближайш\w*)\s+(?:шаг\w*|действ\w*)", re.I),
            re.compile(r"\b(?:мои|текущ\w*)\s+(?:задач\w*|действ\w*)", re.I),
            re.compile(r"\b(?:next|current)\s+(?:action|step|task)s?\b", re.I),
            re.compile(r"(?:下一步|待办|当前任务)"),
        ),
    ),
    _IntentContract(
        tool_name="getDealSummary",
        mode=ToolMode.READ_ONLY,
        patterns=(
            re.compile(r"\bсводк\w*\s+(?:по\s+)?сделк\w*", re.I),
            re.compile(r"\bстатус\w*\s+сделк\w*", re.I),
            re.compile(r"\bчто\s+(?:с|со)\s+сделк\w*", re.I),
            re.compile(r"\b(?:покажи|открой|дай)\s+(?:мне\s+)?сделк\w*", re.I),
            re.compile(r"\bdeal\s+(?:summary|status|overview)\b", re.I),
            re.compile(r"(?:交易摘要|交易状态|交易概览)"),
        ),
    ),
)

_INJECTION_SIGNALS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "IGNORE_AUTHORITY_INSTRUCTION",
        re.compile(
            r"(?:ignore|disregard|bypass)\s+(?:all\s+)?(?:previous|system|developer|policy)|"
            r"игнориру\w*\s+(?:все\s+)?(?:предыдущ\w*|системн\w*|правил\w*)|"
            r"忽略(?:之前|系统|开发者)",
            re.I,
        ),
    ),
    (
        "PROMPT_AUTHORITY_DISCLOSURE",
        re.compile(
            r"(?:system\s+prompt|developer\s+message|hidden\s+instructions)|"
            r"(?:системн\w*\s+промпт|скрыт\w*\s+инструкц\w*)|(?:系统提示词|隐藏指令)",
            re.I,
        ),
    ),
    (
        "DIRECT_TOOL_INVOCATION_SYNTAX",
        re.compile(
            r"(?:tool_call|function_call|<tool|<system|\{\s*\"tool_name\")|"
            r"(?:вызови|запусти|invoke|call)\s+"
            r"(?:getDealSummary|getRoleNextActions|prepareCommandDraft|assignLogistics)",
            re.I,
        ),
    ),
    (
        "SECURITY_BYPASS_REQUEST",
        re.compile(
            r"(?:bypass|disable|skip)\s+(?:rbac|rls|authorization|confirmation)|"
            r"(?:обойди|отключи|пропусти)\s+(?:rbac|rls|авторизац\w*|подтвержден\w*)",
            re.I,
        ),
    ),
)

_DEAL_PATTERNS = (
    re.compile(r"\bdeal[_ -]?id\s*[:=]\s*([A-Za-z0-9._:-]{1,160})", re.I),
    re.compile(
        r"\b(?:deal|сделк\w*)\s*(?:№|#|id|ид|номер)\s*[:=]?\s*"
        r"([A-Za-z0-9._:-]{1,160})",
        re.I,
    ),
    re.compile(r"(?:交易|成交)(?:编号|ID)\s*[:=：]?\s*([A-Za-z0-9._:-]{1,160})", re.I),
)
_ACTION_PATTERNS = (
    re.compile(r"\baction[_ -]?id\s*[:=]\s*([A-Za-z0-9._:-]{1,160})", re.I),
    re.compile(
        r"\b(?:действ\w*|action)\s*(?:№|#|id|ид|номер)\s*[:=]?\s*"
        r"([A-Za-z0-9._:-]{1,160})",
        re.I,
    ),
)


class GovernedToolPlanner:
    """Select at most one explicitly governed platform tool."""

    def __init__(
        self,
        *,
        available_tools: frozenset[str],
        decision_sink: PlannerDecisionSink | None = None,
    ) -> None:
        contracts = {contract.tool_name: contract for contract in _INTENTS}
        unsupported = available_tools - set(contracts)
        if unsupported:
            raise ValueError(f"planner received unsupported tools: {sorted(unsupported)}")
        for name in available_tools:
            definition = TOOL_REGISTRY.get(name)
            contract = contracts[name]
            if definition is None or definition.mode is not contract.mode:
                raise ValueError("planner catalog mode does not match registered authority")
        self._available_tools = available_tools
        self._decision_sink = decision_sink or NullPlannerDecisionSink()

    def plan(
        self,
        *,
        request: OrchestrationRequest,
        grounded: GroundedAnswerResponse,
        trace_id: UUID,
        now: datetime,
    ) -> AgentToolPlan:
        del grounded
        normalized = _normalize(request.question)
        input_sha256 = _input_sha256(request.identity, request.request_id, normalized)
        plan_id = uuid5(NAMESPACE_URL, f"tai-governed-plan:{trace_id}:{input_sha256}")
        calls: tuple[PlannedToolCall, ...] = ()
        status = PlannerDecisionStatus.NO_MATCH
        reasons: tuple[str, ...] = ("NO_SUPPORTED_INTENT",)
        signals = _injection_signals(normalized)

        if signals:
            status = PlannerDecisionStatus.REJECTED
            reasons = ("PROMPT_INJECTION_REJECTED",)
        else:
            matches = tuple(
                contract
                for contract in _INTENTS
                if any(pattern.search(normalized) for pattern in contract.patterns)
            )
            if len(matches) > 1:
                status = PlannerDecisionStatus.REJECTED
                reasons = ("AMBIGUOUS_TOOL_INTENT",)
            elif matches:
                calls, status, reasons = self._build_call(
                    contract=matches[0],
                    request=request,
                    normalized=normalized,
                )

        plan = AgentToolPlan(
            trace_id=trace_id,
            plan_id=plan_id,
            calls=calls,
            generated_at=now,
        )
        selected = tuple(
            PlannerSelectedCall(
                call_id=call.call_id,
                tool_name=call.tool_name,
                mode=call.requested_mode,
                arguments_sha256=_sha256(dict(call.arguments)),
            )
            for call in calls
        )
        decision_at = request.requested_at
        payload = _decision_payload(
            trace_id=trace_id,
            plan_id=plan_id,
            request=request,
            status=status,
            input_sha256=input_sha256,
            selected_calls=selected,
            reason_codes=reasons,
            rejection_signals=signals,
            generated_at=decision_at,
        )
        decision = PlannerDecision(
            trace_id=trace_id,
            plan_id=plan_id,
            request_id=request.request_id,
            tenant_id=request.identity.tenant_id,
            user_id=request.identity.user_id,
            session_id=request.identity.session_id,
            status=status,
            catalog_version=_CATALOG_VERSION,
            input_sha256=input_sha256,
            selected_calls=selected,
            reason_codes=reasons,
            rejection_signals=signals,
            generated_at=decision_at,
            decision_sha256=_sha256(payload),
        )
        self._decision_sink.record(decision)
        return plan

    def _build_call(
        self,
        *,
        contract: _IntentContract,
        request: OrchestrationRequest,
        normalized: str,
    ) -> tuple[tuple[PlannedToolCall, ...], PlannerDecisionStatus, tuple[str, ...]]:
        if contract.tool_name not in self._available_tools:
            return (), PlannerDecisionStatus.NO_MATCH, ("TOOL_NOT_CONFIGURED",)
        definition = TOOL_REGISTRY[contract.tool_name]
        if not request.identity.roles.intersection(definition.allowed_roles):
            return (), PlannerDecisionStatus.REJECTED, ("ROLE_NOT_AUTHORIZED",)
        if definition.requires_mfa and not request.identity.mfa_verified:
            return (), PlannerDecisionStatus.REJECTED, ("MFA_REQUIRED",)
        deal_ids = _extract_unique(_DEAL_PATTERNS, normalized)
        if len(deal_ids) != 1:
            reason = "DEAL_ID_AMBIGUOUS" if deal_ids else "DEAL_ID_REQUIRED"
            return (), PlannerDecisionStatus.NO_MATCH, (reason,)
        arguments: dict[str, Any] = {"dealId": deal_ids[0]}
        if contract.tool_name == "prepareCommandDraft":
            action_ids = _extract_unique(_ACTION_PATTERNS, normalized)
            if len(action_ids) > 1:
                return (), PlannerDecisionStatus.NO_MATCH, ("ACTION_ID_AMBIGUOUS",)
            if action_ids:
                arguments["actionId"] = action_ids[0]
        elif contract.tool_name == "assignLogistics":
            extracted = {
                field: _extract_named_value(normalized, field)
                for field in _ASSIGN_LOGISTICS_FIELDS
            }
            if any(value is None for value in extracted.values()):
                return (), PlannerDecisionStatus.NO_MATCH, (
                    "ASSIGN_LOGISTICS_FIELDS_REQUIRED",
                )
            arguments.update({key: value for key, value in extracted.items() if value})
        _validate_arguments(contract.tool_name, arguments)
        call_sha256 = _sha256({"arguments": arguments, "tool_name": contract.tool_name})
        call = PlannedToolCall(
            call_id=f"planner-{call_sha256[:24]}",
            tool_name=contract.tool_name,
            arguments=arguments,
            requested_mode=contract.mode,
        )
        return (call,), PlannerDecisionStatus.SELECTED, ("EXPLICIT_USER_INTENT",)


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value.replace("№", " #"))
    safe = "".join(
        character
        for character in normalized
        if character in {"\n", "\r", "\t"} or unicodedata.category(character) != "Cc"
    )
    return _WHITESPACE.sub(" ", safe).strip()


def _injection_signals(value: str) -> tuple[str, ...]:
    return tuple(code for code, pattern in _INJECTION_SIGNALS if pattern.search(value))


def _extract_unique(patterns: tuple[re.Pattern[str], ...], value: str) -> tuple[str, ...]:
    found: list[str] = []
    for pattern in patterns:
        for match in pattern.finditer(value):
            candidate = match.group(1)
            if _PORTABLE.fullmatch(candidate) is not None and candidate not in found:
                found.append(candidate)
    return tuple(found)


def _extract_named_value(value: str, name: str) -> str | None:
    pattern = re.compile(rf"\b{re.escape(name)}\s*[:=]\s*([^\s,;]+)", re.I)
    matches = {match.group(1) for match in pattern.finditer(value)}
    if len(matches) != 1:
        return None
    return next(iter(matches))


def _validate_arguments(tool_name: str, arguments: Mapping[str, Any]) -> None:
    allowed = {
        "getDealSummary": frozenset({"dealId"}),
        "getRoleNextActions": frozenset({"dealId"}),
        "prepareCommandDraft": frozenset({"dealId", "actionId"}),
        "assignLogistics": frozenset({"dealId", *_ASSIGN_LOGISTICS_FIELDS}),
    }[tool_name]
    if set(arguments) - allowed or "dealId" not in arguments:
        raise ValueError("planner generated an invalid argument schema")
    if tool_name == "assignLogistics" and set(arguments) != allowed:
        raise ValueError("planner generated an incomplete logistics argument schema")
    for key, value in arguments.items():
        if not isinstance(value, str):
            raise ValueError(f"planner argument {key} must be a string")
        if key == "expectedUpdatedAt":
            _validate_iso(value)
        elif key == "expectedVersion":
            if _VERSION.fullmatch(value) is None:
                raise ValueError("planner expectedVersion is invalid")
        elif _PORTABLE.fullmatch(value) is None:
            raise ValueError(f"planner argument {key} is not portable")


def _validate_iso(value: str) -> None:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("planner expectedUpdatedAt is invalid") from error
    if parsed.utcoffset() is None:
        raise ValueError("planner expectedUpdatedAt must be timezone-aware")


def _input_sha256(identity: IdentityContext, request_id: str, question: str) -> str:
    return _sha256(
        {
            "authenticated": identity.authenticated,
            "mfa_verified": identity.mfa_verified,
            "question": question,
            "request_id": request_id,
            "roles": sorted(identity.roles),
            "session_id": str(identity.session_id),
            "tenant_id": None if identity.tenant_id is None else str(identity.tenant_id),
            "user_id": str(identity.user_id),
        }
    )


def _decision_payload(
    *,
    trace_id: UUID,
    plan_id: UUID,
    request: OrchestrationRequest,
    status: PlannerDecisionStatus,
    input_sha256: str,
    selected_calls: tuple[PlannerSelectedCall, ...],
    reason_codes: tuple[str, ...],
    rejection_signals: tuple[str, ...],
    generated_at: datetime,
) -> dict[str, Any]:
    return {
        "catalog_version": _CATALOG_VERSION,
        "generated_at": generated_at.isoformat(),
        "input_sha256": input_sha256,
        "plan_id": str(plan_id),
        "reason_codes": list(reason_codes),
        "rejection_signals": list(rejection_signals),
        "request_id": request.request_id,
        "selected_calls": [
            {
                "arguments_sha256": item.arguments_sha256,
                "call_id": item.call_id,
                "mode": item.mode.value,
                "tool_name": item.tool_name,
            }
            for item in selected_calls
        ],
        "session_id": str(request.identity.session_id),
        "status": status.value,
        "tenant_id": (
            None if request.identity.tenant_id is None else str(request.identity.tenant_id)
        ),
        "trace_id": str(trace_id),
        "user_id": str(request.identity.user_id),
    }


def _sha256(value: Any) -> str:
    canonical = json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()
