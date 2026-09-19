from __future__ import annotations

import base64
import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest

from tai.identity_assertion import (
    HMACPlatformIdentityAuthority,
    IdentityAssertionError,
    PlatformIdentityAssertion,
    SignedIdentityAssertion,
    canonical_api_request_sha256,
    canonical_request_sha256,
)

NOW = datetime(2026, 7, 18, 15, 0, tzinfo=UTC)
USER_ID = UUID("10000000-0000-0000-0000-000000000001")
TENANT_ID = UUID("20000000-0000-0000-0000-000000000002")
SESSION_ID = UUID("30000000-0000-0000-0000-000000000003")
SECRET = b"platform-to-tai-identity-secret-32-bytes"
REQUEST_PAYLOAD = {"question": "Какой следующий шаг?", "locale": "ru"}
REQUEST_SHA = canonical_request_sha256(REQUEST_PAYLOAD)
REQUEST_TOKEN_A = "a" * 16
REQUEST_TOKEN_B = "b" * 16


def _assertion(**overrides: object) -> PlatformIdentityAssertion:
    values: dict[str, object] = {
        "request_id": "request-identity-1",
        "request_sha256": REQUEST_SHA,
        "user_id": USER_ID,
        "tenant_id": TENANT_ID,
        "roles": ("buyer", "executive"),
        "session_id": SESSION_ID,
        "mfa_verified": True,
        "issued_at": NOW,
        "expires_at": NOW + timedelta(seconds=30),
    }
    values.update(overrides)
    return PlatformIdentityAssertion(**values)  # type: ignore[arg-type]


def test_signed_identity_is_request_bound_and_server_authoritative() -> None:
    authority = HMACPlatformIdentityAuthority(SECRET)
    signed = authority.issue(_assertion())

    identity = authority.verify(
        signed,
        expected_request_id="request-identity-1",
        expected_request_sha256=REQUEST_SHA,
        now=NOW + timedelta(seconds=1),
    )

    assert identity.user_id == USER_ID
    assert identity.tenant_id == TENANT_ID
    assert identity.roles == frozenset({"buyer", "executive"})
    assert identity.session_id == SESSION_ID
    assert identity.mfa_verified is True
    assert identity.authenticated is True


@pytest.mark.parametrize(
    ("request_id", "request_sha", "message"),
    [
        ("other-request", REQUEST_SHA, "request binding"),
        ("request-identity-1", "f" * 64, "payload binding"),
    ],
)
def test_request_or_payload_rebinding_is_rejected(
    request_id: str,
    request_sha: str,
    message: str,
) -> None:
    authority = HMACPlatformIdentityAuthority(SECRET)
    signed = authority.issue(_assertion())

    with pytest.raises(IdentityAssertionError, match=message):
        authority.verify(
            signed,
            expected_request_id=request_id,
            expected_request_sha256=request_sha,
            now=NOW,
        )


def test_signature_tampering_expiry_and_future_issue_are_rejected() -> None:
    authority = HMACPlatformIdentityAuthority(SECRET)
    signed = authority.issue(_assertion())

    with pytest.raises(IdentityAssertionError, match="invalid"):
        authority.verify(
            replace(signed, signature_sha256="0" * 64),
            expected_request_id="request-identity-1",
            expected_request_sha256=REQUEST_SHA,
            now=NOW,
        )
    with pytest.raises(IdentityAssertionError, match="expired"):
        authority.verify(
            signed,
            expected_request_id="request-identity-1",
            expected_request_sha256=REQUEST_SHA,
            now=NOW + timedelta(minutes=1),
        )
    future = authority.issue(
        _assertion(
            issued_at=NOW + timedelta(seconds=10),
            expires_at=NOW + timedelta(seconds=40),
        )
    )
    with pytest.raises(IdentityAssertionError, match="future"):
        authority.verify(
            future,
            expected_request_id="request-identity-1",
            expected_request_sha256=REQUEST_SHA,
            now=NOW,
        )


def test_noncanonical_unknown_or_wrongly_typed_payload_is_rejected() -> None:
    authority = HMACPlatformIdentityAuthority(SECRET)
    signed = authority.issue(_assertion())
    decoded = json.loads(
        base64.urlsafe_b64decode(signed.payload + "=" * (-len(signed.payload) % 4))
    )
    decoded["roles"] = "buyer"
    noncanonical = json.dumps(decoded, ensure_ascii=False).encode()
    payload = base64.urlsafe_b64encode(noncanonical).rstrip(b"=").decode()
    malformed = SignedIdentityAssertion(payload=payload, signature_sha256="0" * 64)

    with pytest.raises(IdentityAssertionError, match="invalid"):
        authority.verify(
            malformed,
            expected_request_id="request-identity-1",
            expected_request_sha256=REQUEST_SHA,
            now=NOW,
        )


def test_assertion_policy_rejects_weak_secret_bad_roles_and_long_ttl() -> None:
    with pytest.raises(ValueError, match="32 bytes"):
        HMACPlatformIdentityAuthority(b"short")
    with pytest.raises(ValueError, match="role"):
        _assertion(roles=())
    with pytest.raises(ValueError, match="role names"):
        _assertion(roles=("BUYER",))
    authority = HMACPlatformIdentityAuthority(SECRET)
    with pytest.raises(ValueError, match="TTL"):
        authority.issue(_assertion(expires_at=NOW + timedelta(minutes=2)))


def test_api_request_hash_binds_route_and_idempotency_key() -> None:
    payload = {"request_id": "request-1", "question": "Что дальше?"}
    answer = canonical_api_request_sha256(
        method="post",
        path="/v1/platform/answer",
        payload=payload,
        idempotency_key=REQUEST_TOKEN_A,
    )

    assert answer != canonical_api_request_sha256(
        method="POST",
        path="/v1/platform/actions/confirm",
        payload=payload,
        idempotency_key=REQUEST_TOKEN_A,
    )
    assert answer != canonical_api_request_sha256(
        method="POST",
        path="/v1/platform/answer",
        payload=payload,
        idempotency_key=REQUEST_TOKEN_B,
    )
