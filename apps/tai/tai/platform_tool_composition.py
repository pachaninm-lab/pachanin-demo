from __future__ import annotations

import base64
import binascii
import json
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5

from tai.agent_runtime import (
    AgentToolPlan,
    AuthorizedToolInvocation,
    PlannedToolCall,
    ToolHandler,
)
from tai.contracts import ToolMode
from tai.orchestration import OrchestrationRequest, ToolPlanner
from tai.platform_tools import (
    HTTPClientPlatformToolTransport,
    PlatformToolAssertionAuthority,
    PlatformToolConfigurationError,
    PlatformToolEndpointPolicy,
    PlatformToolTransport,
    canonical_platform_tool_json,
)
from tai.rag_pipeline import GroundedAnswerResponse

_PLATFORM_TOOL_MODES: dict[str, ToolMode] = {
    "getDealSummary": ToolMode.READ_ONLY,
    "getRoleNextActions": ToolMode.READ_ONLY,
    "prepareCommandDraft": ToolMode.DRAFT,
}
_DRAFT_ROLES = frozenset(
    {"buyer", "seller", "logistics", "elevator", "laboratory", "bank", "operator"}
)
_EXPLICIT_DEAL = re.compile(
    r"(?:сделк(?:а|и|е|у|ой)?|deal|deal_id|dealid)\s*(?:№|#|id|ID|:|=)?\s*"
    r"([A-Za-z0-9][A-Za-z0-9._:-]{2,159})",
    re.IGNORECASE,
)
_UUID = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)
_NEXT_ACTION = re.compile(
    r"(?:следующ(?:ее|ий|ая)|что\s+делать|next\s+(?:action|step)|下一步)",
    re.IGNORECASE,
)
_DRAFT = re.compile(
    r"(?:подготов(?:ь|ить|ьте)|черновик|сформируй\s+команд|prepare\s+(?:a\s+)?draft|draft\s+command|草稿)",
    re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class PlatformToolRuntimeSettings:
    base_url: str
    secret: bytes
    allowed_hosts: frozenset[str]
    timeout_seconds: float

    @classmethod
    def from_environment(
        cls,
        environment: Mapping[str, str],
    ) -> PlatformToolRuntimeSettings:
        base_url = _required(environment, "TAI_PLATFORM_API_BASE_URL")
        secret = _secret(environment, "TAI_PLATFORM_TOOL_HMAC_SECRET_B64")
        allowed_hosts = frozenset(
            _string_set(environment.get("TAI_ALLOWED_PLATFORM_HOSTS_JSON"), {"localhost"})
        )
        timeout_seconds = _number(environment, "TAI_PLATFORM_TOOL_TIMEOUT_SECONDS", 10.0)
        if not 0.1 <= timeout_seconds <= 60:
            raise PlatformToolConfigurationError(
                "TAI_PLATFORM_TOOL_TIMEOUT_SECONDS must be between 0.1 and 60"
            )
        PlatformToolEndpointPolicy(allowed_hosts=allowed_hosts).validate_base_url(base_url)
        return cls(base_url, secret, allowed_hosts, timeout_seconds)


class PlatformApiSafeToolHandler:
    """Call the platform API through a request-bound internal gateway."""

    def __init__(
        self,
        *,
        settings: PlatformToolRuntimeSettings,
        transport: PlatformToolTransport | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._base_url = PlatformToolEndpointPolicy(
            allowed_hosts=settings.allowed_hosts
        ).validate_base_url(settings.base_url)
        self._assertions = PlatformToolAssertionAuthority(settings.secret)
        self._transport = transport or HTTPClientPlatformToolTransport()
        self._timeout_seconds = settings.timeout_seconds
        self._clock = clock or (lambda: datetime.now(UTC))

    def execute(self, invocation: AuthorizedToolInvocation) -> Mapping[str, Any]:
        expected_mode = _PLATFORM_TOOL_MODES.get(invocation.tool_name)
        if expected_mode is None or invocation.mode is not expected_mode:
            raise PermissionError("platform tool is not executable by this adapter")
        body = {"arguments": dict(invocation.arguments)}
        if len(canonical_platform_tool_json(body).encode()) > 32_768:
            raise ValueError("platform tool arguments exceeded the byte budget")
        path = f"/api/internal/tai/tools/{invocation.tool_name}"
        signed = self._assertions.issue(
            invocation,
            path=path,
            body=body,
            issued_at=self._clock(),
        )
        return self._transport.post_json(
            base_url=self._base_url,
            path=path,
            payload=body,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "transparent-agro-intelligence/platform-tools",
                "X-Idempotency-Key": invocation.idempotency_key,
                "X-TAI-Tool-Assertion": signed.encoded_payload,
                "X-TAI-Tool-Signature": signed.signature_sha256,
            },
            timeout_seconds=self._timeout_seconds,
            maximum_response_bytes=262_144,
        )


def build_platform_api_tool_handlers(
    environment: Mapping[str, str],
    *,
    transport: PlatformToolTransport | None = None,
    clock: Callable[[], datetime] | None = None,
) -> dict[str, ToolHandler]:
    settings = PlatformToolRuntimeSettings.from_environment(environment)
    handler = PlatformApiSafeToolHandler(
        settings=settings,
        transport=transport,
        clock=clock,
    )
    return {name: handler for name in _PLATFORM_TOOL_MODES}


class DeterministicPlatformToolPlanner(ToolPlanner):
    """Plan at most one bounded platform tool from explicit deal-scoped intent."""

    def plan(
        self,
        *,
        request: OrchestrationRequest,
        grounded: GroundedAnswerResponse,
        trace_id: UUID,
        now: datetime,
    ) -> AgentToolPlan:
        del grounded
        deal_id = _deal_id(request.question)
        calls: tuple[PlannedToolCall, ...] = ()
        if deal_id is not None:
            tool_name, mode = self._select(request)
            calls = (
                PlannedToolCall(
                    call_id=f"platform-{tool_name}",
                    tool_name=tool_name,
                    arguments={"dealId": deal_id},
                    requested_mode=mode,
                ),
            )
        return AgentToolPlan(
            trace_id=trace_id,
            plan_id=uuid5(
                NAMESPACE_URL,
                f"tai-platform-plan:{request.request_id}:{trace_id}",
            ),
            calls=calls,
            generated_at=now,
        )

    def _select(self, request: OrchestrationRequest) -> tuple[str, ToolMode]:
        question = request.question
        if _DRAFT.search(question) and request.identity.roles.intersection(_DRAFT_ROLES):
            return "prepareCommandDraft", ToolMode.DRAFT
        if _NEXT_ACTION.search(question):
            return "getRoleNextActions", ToolMode.READ_ONLY
        return "getDealSummary", ToolMode.READ_ONLY


def _deal_id(question: str) -> str | None:
    explicit = _EXPLICIT_DEAL.search(question)
    if explicit is not None:
        return explicit.group(1)
    uuid_match = _UUID.search(question)
    return None if uuid_match is None else uuid_match.group(0)


def _required(source: Mapping[str, str], name: str) -> str:
    value = source.get(name, "").strip()
    if not value:
        raise PlatformToolConfigurationError(f"{name} is required")
    return value


def _secret(source: Mapping[str, str], name: str) -> bytes:
    encoded = _required(source, name)
    try:
        decoded = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise PlatformToolConfigurationError(f"{name} must be valid base64") from error
    if len(decoded) < 32:
        raise PlatformToolConfigurationError(f"{name} must decode to at least 32 bytes")
    return decoded


def _string_set(raw: str | None, default: set[str]) -> set[str]:
    if raw is None or not raw.strip():
        return set(default)
    try:
        decoded = json.loads(raw)
    except json.JSONDecodeError as error:
        raise PlatformToolConfigurationError(
            "TAI_ALLOWED_PLATFORM_HOSTS_JSON is invalid"
        ) from error
    if not isinstance(decoded, list) or any(not isinstance(item, str) for item in decoded):
        raise PlatformToolConfigurationError(
            "TAI_ALLOWED_PLATFORM_HOSTS_JSON must be a string array"
        )
    hosts = {item.strip() for item in decoded}
    if any(not host for host in hosts):
        raise PlatformToolConfigurationError("allowed platform hosts must not be blank")
    return hosts


def _number(source: Mapping[str, str], name: str, default: float) -> float:
    raw = source.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = float(raw)
    except ValueError as error:
        raise PlatformToolConfigurationError(f"{name} must be numeric") from error
    if value != value or value in {float("inf"), float("-inf")}:
        raise PlatformToolConfigurationError(f"{name} must be finite")
    return value
