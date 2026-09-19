"""Continuity between a recorded llama.cpp build acceptance and the current authority.

`llama-cpp-build-acceptance.v1.json` records a build performed at one commit of this
repository. Nothing re-checks that the pin it was built against is still the pin the
repository declares. The record carries an `authority_continuity` block, but that block
is a snapshot taken when the record was written: it cannot notice a later edit to
`llama-cpp-toolchain-authority.v1.json`.

This module answers one narrow question at exact head: does the authority reference
frozen into the acceptance record still equal the authority in the tree? It proves
continuity of the pin. It does not re-run the build, does not touch binaries, and never
raises the maturity of anything — a `CONTINUOUS` result means the pin did not move, not
that a model was acquired, converted, benchmarked or admitted.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Final

from tai.llama_toolchain_contract import load_llama_toolchain_authority
from tai.llama_toolchain_types import AuthorityReference, LlamaToolchainAuthority

ACCEPTANCE_SCHEMA: Final = "tai.llama-cpp-build-acceptance.v1"
CONTINUITY_SCHEMA: Final = "tai.llama-cpp-toolchain-continuity.v1"
OPERATIONAL_STATUS: Final = "NOT_ATTESTED"

_AUTHORITY_KEYS: Final = frozenset(
    {
        "toolchain_name",
        "repository_uri",
        "release",
        "commit",
        "profile_id",
        "authority_sha256",
    }
)


class ContinuityStatus(Enum):
    """Whether the recorded pin still matches the declared one."""

    CONTINUOUS = "CONTINUOUS"
    BROKEN = "BROKEN"


@dataclass(frozen=True, slots=True)
class ContinuityReport:
    """A bounded, machine-readable answer with the reasons that produced it."""

    status: ContinuityStatus
    reasons: tuple[str, ...]
    acceptance_status: str
    recorded: AuthorityReference
    declared_authority_sha256: str
    build_repository_sha: str

    def payload(self) -> dict[str, Any]:
        return {
            "acceptance_status": self.acceptance_status,
            "build_repository_sha": self.build_repository_sha,
            "declared_authority_sha256": self.declared_authority_sha256,
            "operational_status": OPERATIONAL_STATUS,
            "reasons": list(self.reasons),
            "recorded": {
                "authority_sha256": self.recorded.authority_sha256,
                "commit": self.recorded.commit,
                "profile_id": self.recorded.profile_id,
                "release": self.recorded.release,
                "repository_uri": self.recorded.repository_uri,
                "toolchain_name": self.recorded.toolchain_name,
            },
            "schema_version": CONTINUITY_SCHEMA,
            "status": self.status.value,
        }


def load_recorded_authority(acceptance_path: Path) -> tuple[AuthorityReference, str, str]:
    """Read the authority reference the acceptance record was built against.

    Returns the reference, the record's own status and the repository commit the build
    ran at. Parsing is strict: an unexpected shape is a refusal, not a default.
    """
    import json

    payload = json.loads(acceptance_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("build acceptance record must be a JSON object")
    if payload.get("schema_version") != ACCEPTANCE_SCHEMA:
        raise ValueError(f"build acceptance schema must be {ACCEPTANCE_SCHEMA}")

    authority = payload.get("authority")
    if not isinstance(authority, dict):
        raise ValueError("build acceptance record must carry an authority reference")
    if set(authority) != _AUTHORITY_KEYS:
        raise ValueError("authority reference keys must be exact")
    for key, value in authority.items():
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"authority reference {key} must be non-empty text")

    status = payload.get("status")
    if not isinstance(status, str) or not status.strip():
        raise ValueError("build acceptance record must carry a status")

    build_run = payload.get("build_run")
    if not isinstance(build_run, dict):
        raise ValueError("build acceptance record must carry a build run")
    repository_sha = build_run.get("repository_sha")
    if not isinstance(repository_sha, str) or not repository_sha.strip():
        raise ValueError("build run must name the repository commit it ran at")

    reference = AuthorityReference(
        toolchain_name=authority["toolchain_name"],
        repository_uri=authority["repository_uri"],
        release=authority["release"],
        commit=authority["commit"],
        profile_id=authority["profile_id"],
        authority_sha256=authority["authority_sha256"],
    )
    return reference, status, repository_sha


def compare_authority(
    declared: LlamaToolchainAuthority, recorded: AuthorityReference
) -> tuple[str, ...]:
    """Every field that moved, named. An empty result is the only clean one."""
    comparisons = (
        (recorded.toolchain_name, declared.toolchain_name, "TOOLCHAIN_NAME_MISMATCH"),
        (recorded.repository_uri, declared.repository_uri, "REPOSITORY_URI_MISMATCH"),
        (recorded.release, declared.release, "RELEASE_MISMATCH"),
        (recorded.commit, declared.commit, "COMMIT_MISMATCH"),
        (recorded.profile_id, declared.build_profile.profile_id, "BUILD_PROFILE_MISMATCH"),
        (
            recorded.authority_sha256,
            declared.authority_sha256,
            "AUTHORITY_SHA256_MISMATCH",
        ),
    )
    return tuple(reason for actual, expected, reason in comparisons if actual != expected)


def verify_toolchain_continuity(
    *, authority_path: Path, acceptance_path: Path
) -> ContinuityReport:
    """Compare the declared authority at exact head with the one that was built against.

    The canonical digest is recomputed from the authority file rather than trusted from
    either document, so an edit that preserves the recorded digest string but changes the
    pin cannot pass.
    """
    declared = load_llama_toolchain_authority(authority_path)
    recorded, acceptance_status, build_repository_sha = load_recorded_authority(
        acceptance_path
    )
    reasons = compare_authority(declared, recorded)
    return ContinuityReport(
        status=ContinuityStatus.CONTINUOUS if not reasons else ContinuityStatus.BROKEN,
        reasons=reasons,
        acceptance_status=acceptance_status,
        recorded=recorded,
        declared_authority_sha256=declared.authority_sha256,
        build_repository_sha=build_repository_sha,
    )
