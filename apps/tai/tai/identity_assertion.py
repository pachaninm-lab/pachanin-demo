from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from tai.contracts import IdentityContext

_SCHEMA_VERSION = "tai.platform-identity.v1"
_AUDIENCE = "tai-api"
_ROLE = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_SIGNATURE = re.compile(r"^[0-9a-f]{64}$")
_EXPECTED_KEYS = frozenset(
    {
        "audience",
        "expires_at",
        "issued_at",
        "mfa_verified",
        "request_id",
        "request_sha256",
        "roles",
        "schema_version",
        "session_id",
        "tenant_id",
        "user_id",
    }
)


class IdentityAssertionError(PermissionError):
    pass


@dataclass(frozen=True, slots=True)
class PlatformIdentityAssertion:
    request_id: str
    request_sha256: str
    user_id: UUID
    tenant_id: UUID | None
    roles: tuple[str, ...]
    session_id: UUID
    mfa_verified: bool
    issued_at: datetime
    expires_at: datetime
    audience: str = _AUDIENCE
    schema_version: str = _SCHEMA_VERSION

    def __post_init__(self) -> None:
        if not self.request_id.strip() or len(self.request_id) > 160:
            raise ValueError("request_id must be a bounded non-blank value")
        if _SHA256.fullmatch(self.request_sha256) is None:
            raise ValueError("request_sha256 must be a lowercase SHA-256 digest")
        if not self.roles:
            raise ValueError("at least one server-authoritative role is required")
        if len(self.roles) > 32 or len(self.roles) != len(set(self.roles)):
            raise ValueError("roles must be unique and contain at most 32 values")
        if any(_ROLE.fullmatch(role) is None for role in self.roles):
            raise ValueError("role names must use bounded lowercase identifiers")
        _aware(self.issued_at, "issued_at")
        _aware(self.expires_at, "expires_at")
        if self.expires_at <= self.issued_at:
            raise ValueError("expires_at must be after issued_at")
        if self.audience != _AUDIENCE:
            raise ValueError("identity assertion audience is invalid")
        if self.schema_version != _SCHEMA_VERSION:
            raise ValueError("identity assertion schema version is invalid")

    def identity(self) -> IdentityContext:
        return IdentityContext(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            roles=frozenset(self.roles),
            session_id=self.session_id,
            mfa_verified=self.mfa_verified,
            authenticated=True,
        )


@dataclass(frozen=True, slots=True)
class SignedIdentityAssertion:
    payload: str
    signature_sha256: str

    def __post_init__(self) -> None:
        if not self.payload.strip() or len(self.payload) > 16_384:
            raise ValueError("identity assertion payload is invalid")
        if _SIGNATURE.fullmatch(self.signature_sha256) is None:
            raise ValueError("identity assertion signature must be a SHA-256 digest")


class HMACPlatformIdentityAuthority:
    """Verify request-bound identity assertions issued by the platform server."""

    def __init__(
        self,
        secret: bytes,
        *,
        maximum_ttl: timedelta = timedelta(seconds=60),
        maximum_clock_skew: timedelta = timedelta(seconds=5),
    ) -> None:
        if len(secret) < 32:
            raise ValueError("identity assertion secret must contain at least 32 bytes")
        if maximum_ttl <= timedelta(0):
            raise ValueError("maximum_ttl must be positive")
        if maximum_clock_skew < timedelta(0):
            raise ValueError("maximum_clock_skew must not be negative")
        self._secret = bytes(secret)
        self._maximum_ttl = maximum_ttl
        self._maximum_clock_skew = maximum_clock_skew

    def issue(self, assertion: PlatformIdentityAssertion) -> SignedIdentityAssertion:
        if assertion.expires_at - assertion.issued_at > self._maximum_ttl:
            raise ValueError("identity assertion TTL exceeds authority policy")
        canonical = _canonical_json(_payload(assertion)).encode()
        return SignedIdentityAssertion(
            payload=_b64url_encode(canonical),
            signature_sha256=hmac.new(
                self._secret,
                canonical,
                hashlib.sha256,
            ).hexdigest(),
        )

    def verify(
        self,
        signed: SignedIdentityAssertion,
        *,
        expected_request_id: str,
        expected_request_sha256: str,
        now: datetime,
    ) -> IdentityContext:
        _aware(now, "now")
        try:
            canonical = _b64url_decode(signed.payload)
            decoded = json.loads(canonical)
            if not isinstance(decoded, dict) or set(decoded) != _EXPECTED_KEYS:
                raise ValueError("unexpected identity assertion shape")
            if canonical != _canonical_json(decoded).encode():
                raise ValueError("identity assertion payload is not canonical")
            expected_signature = hmac.new(
                self._secret,
                canonical,
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(signed.signature_sha256, expected_signature):
                raise ValueError("identity assertion signature is invalid")
            assertion = _from_payload(decoded)
        except (TypeError, ValueError, json.JSONDecodeError) as error:
            raise IdentityAssertionError("identity assertion is invalid") from error

        if assertion.request_id != expected_request_id.strip():
            raise IdentityAssertionError("identity assertion request binding failed")
        if assertion.request_sha256 != expected_request_sha256:
            raise IdentityAssertionError("identity assertion payload binding failed")
        if assertion.expires_at - assertion.issued_at > self._maximum_ttl:
            raise IdentityAssertionError("identity assertion TTL exceeds policy")
        if assertion.issued_at > now + self._maximum_clock_skew:
            raise IdentityAssertionError("identity assertion was issued in the future")
        if assertion.expires_at <= now - self._maximum_clock_skew:
            raise IdentityAssertionError("identity assertion is expired")
        return assertion.identity()


def canonical_request_sha256(payload: Any) -> str:
    return hashlib.sha256(_canonical_json(payload).encode()).hexdigest()


def canonical_api_request_sha256(
    *,
    method: str,
    path: str,
    payload: Any,
    idempotency_key: str | None = None,
) -> str:
    normalized_method = method.strip().upper()
    normalized_path = path.strip()
    if normalized_method not in {"DELETE", "GET", "PATCH", "POST", "PUT"}:
        raise ValueError("API request method is invalid")
    if not normalized_path.startswith("/") or len(normalized_path) > 512:
        raise ValueError("API request path is invalid")
    return canonical_request_sha256(
        {
            "idempotency_key": idempotency_key,
            "method": normalized_method,
            "path": normalized_path,
            "payload": payload,
        }
    )


def _payload(assertion: PlatformIdentityAssertion) -> dict[str, Any]:
    return {
        "audience": assertion.audience,
        "expires_at": _iso(assertion.expires_at),
        "issued_at": _iso(assertion.issued_at),
        "mfa_verified": assertion.mfa_verified,
        "request_id": assertion.request_id.strip(),
        "request_sha256": assertion.request_sha256,
        "roles": list(assertion.roles),
        "schema_version": assertion.schema_version,
        "session_id": str(assertion.session_id),
        "tenant_id": None if assertion.tenant_id is None else str(assertion.tenant_id),
        "user_id": str(assertion.user_id),
    }


def _from_payload(payload: dict[str, Any]) -> PlatformIdentityAssertion:
    roles = payload["roles"]
    if not isinstance(roles, list) or any(not isinstance(role, str) for role in roles):
        raise ValueError("roles must be an array of strings")
    tenant = payload["tenant_id"]
    if tenant is not None and not isinstance(tenant, str):
        raise ValueError("tenant_id must be null or a UUID string")
    return PlatformIdentityAssertion(
        request_id=_required_string(payload, "request_id"),
        request_sha256=_required_string(payload, "request_sha256"),
        user_id=UUID(_required_string(payload, "user_id")),
        tenant_id=None if tenant is None else UUID(tenant),
        roles=tuple(roles),
        session_id=UUID(_required_string(payload, "session_id")),
        mfa_verified=_required_bool(payload, "mfa_verified"),
        issued_at=_datetime(payload, "issued_at"),
        expires_at=_datetime(payload, "expires_at"),
        audience=_required_string(payload, "audience"),
        schema_version=_required_string(payload, "schema_version"),
    )


def _required_string(payload: dict[str, Any], name: str) -> str:
    value = payload[name]
    if not isinstance(value, str):
        raise ValueError(f"{name} must be a string")
    return value


def _required_bool(payload: dict[str, Any], name: str) -> bool:
    value = payload[name]
    if not isinstance(value, bool):
        raise ValueError(f"{name} must be a boolean")
    return value


def _datetime(payload: dict[str, Any], name: str) -> datetime:
    value = _required_string(payload, name)
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    _aware(parsed, name)
    return parsed


def _canonical_json(payload: Any) -> str:
    return json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
        allow_nan=False,
    )


def _b64url_encode(payload: bytes) -> str:
    return base64.urlsafe_b64encode(payload).rstrip(b"=").decode("ascii")


def _b64url_decode(payload: str) -> bytes:
    encoded = payload.encode("ascii")
    padding = b"=" * (-len(encoded) % 4)
    return base64.b64decode(encoded + padding, altchars=b"-_", validate=True)


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")
