from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass

from tai.main import ReadinessStatus
from tai.postgres_loader_state import ConnectionFactory

_IDENTITY = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_GIT_SHA = re.compile(r"^[0-9a-f]{40}$")


class RestrictedModelAuthorityError(ValueError):
    """Raised when the protected restricted-model authority is malformed."""


@dataclass(frozen=True, slots=True)
class RestrictedModelOperationalAuthority:
    model_id: str
    revision: str
    artifact_sha256: str
    activation_sha: str

    def __post_init__(self) -> None:
        if _IDENTITY.fullmatch(self.model_id) is None:
            raise RestrictedModelAuthorityError("restricted model_id is invalid")
        if _IDENTITY.fullmatch(self.revision) is None:
            raise RestrictedModelAuthorityError("restricted model revision is invalid")
        if _SHA256.fullmatch(self.artifact_sha256) is None:
            raise RestrictedModelAuthorityError("restricted model artifact SHA-256 is invalid")
        if _GIT_SHA.fullmatch(self.activation_sha) is None:
            raise RestrictedModelAuthorityError("restricted activation exact-main SHA is invalid")

    @classmethod
    def from_environment(
        cls,
        source: Mapping[str, str],
    ) -> RestrictedModelOperationalAuthority | None:
        enabled = source.get("TAI_RESTRICTED_MODEL_OPERATIONAL", "").strip().lower()
        if not enabled:
            return None
        if enabled != "true":
            raise RestrictedModelAuthorityError(
                "TAI_RESTRICTED_MODEL_OPERATIONAL must be true when configured"
            )
        return cls(
            model_id=_required(source, "TAI_RESTRICTED_MODEL_ID"),
            revision=_required(source, "TAI_RESTRICTED_MODEL_REVISION"),
            artifact_sha256=_required(
                source,
                "TAI_RESTRICTED_MODEL_ARTIFACT_SHA256",
            ),
            activation_sha=_required(source, "TAI_RESTRICTED_ACTIVATION_SHA"),
        )


class RestrictedModelOperationalReadinessProbe:
    """Authorize one exact digest-bound restricted model without faking admission.

    The protected REG.RU controller is responsible for creating the root-owned
    environment authority and matching PostgreSQL model profile. Permanent model
    admission remains visible as a separate maturity component and is never
    synthesized by this probe.
    """

    def __init__(
        self,
        *,
        delegate: object,
        connection_factory: ConnectionFactory,
        authority: RestrictedModelOperationalAuthority,
    ) -> None:
        if not hasattr(delegate, "check"):
            raise TypeError("delegate must provide check()")
        self._delegate = delegate
        self._connection_factory = connection_factory
        self._authority = authority

    def check(self) -> ReadinessStatus:
        base = self._delegate.check()
        components = dict(base.components)
        reasons = list(base.reasons)
        try:
            active_count, matching_count, admitted_count = self._counts()
        except Exception:
            active_count, matching_count, admitted_count = 0, 0, 0

        authorized = active_count == 1 and matching_count == 1
        permanently_admitted = authorized and admitted_count == 1
        components["restricted_model"] = "authorized" if authorized else "invalid"
        components["model_admission"] = (
            "accepted" if permanently_admitted else "not_attested"
        )
        components["model_activation"] = self._authority.activation_sha
        if not authorized:
            reasons.append("RESTRICTED_MODEL_AUTHORITY_INVALID")

        unique_reasons = tuple(dict.fromkeys(reasons))
        return ReadinessStatus(not unique_reasons, components, unique_reasons)

    def _counts(self) -> tuple[int, int, int]:
        query = """
            SELECT
                COUNT(*) FILTER (WHERE profile.status = 'ACTIVE')::int AS active_count,
                COUNT(*) FILTER (
                    WHERE profile.status = 'ACTIVE'
                      AND profile.model_id = %s
                      AND profile.revision = %s
                      AND profile.artifact_sha256 = %s
                )::int AS matching_count,
                COUNT(*) FILTER (
                    WHERE profile.status = 'ACTIVE'
                      AND profile.model_id = %s
                      AND profile.revision = %s
                      AND profile.artifact_sha256 = %s
                      AND admission.accepted IS TRUE
                      AND admission.artifact_sha256 = profile.artifact_sha256
                )::int AS admitted_count
            FROM tai_local_model_profiles AS profile
            LEFT JOIN tai_current_model_admission_v1 AS admission
              ON admission.model_id = profile.model_id
             AND admission.revision = profile.revision
        """
        values = (
            self._authority.model_id,
            self._authority.revision,
            self._authority.artifact_sha256,
        )
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, (*values, *values))
                    row = cursor.fetchone()
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        if row is None:
            return 0, 0, 0
        return (
            int(row["active_count"]),
            int(row["matching_count"]),
            int(row["admitted_count"]),
        )


def _required(source: Mapping[str, str], name: str) -> str:
    value = source.get(name, "").strip()
    if not value:
        raise RestrictedModelAuthorityError(f"{name} is required")
    return value
