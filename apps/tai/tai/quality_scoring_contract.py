from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Any

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
IDENTITY_RE = re.compile(r"^[A-Za-z0-9._:/+=-]{1,240}$")
PROFILES = ("qwen3-8b-cpu-q4-k-m", "mistral-7b-fallback-cpu-q4-k-m")
LOCALES = ("ru", "en", "zh")
ALLOWED_SCORER_ROLES = (
    "PLATFORM_OWNER",
    "DOMAIN_EXPERT",
    "SECURITY_REVIEWER",
    "LEGAL_OR_METHOD_REVIEWER",
)
SECONDARY_ROLES = ("SECURITY_REVIEWER", "LEGAL_OR_METHOD_REVIEWER")
VERIFIED_RUNTIME_STATUS = "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING"
VERIFIED_QUALITY_STATUS = "QUALITY_SCORING_VERIFIED_PENDING_BENCHMARK_FINALIZATION"
EXPECTED_RUNTIME_MATURITY = {
    "quality_scoring_status": "PENDING_QUALITY_SCORING",
    "benchmark_status": "PENDING_BENCHMARK",
    "model_admission_status": "PENDING_ADMISSION",
    "production_operational_status": "NOT_ATTESTED",
}
EXPECTED_QUALITY_MATURITY = {
    "benchmark_status": "PENDING_BENCHMARK",
    "model_admission_status": "PENDING_ADMISSION",
    "production_operational_status": "NOT_ATTESTED",
}


class QualityScoringError(ValueError):
    pass


def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise QualityScoringError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicates
        )
    except (OSError, UnicodeError, json.JSONDecodeError, QualityScoringError) as exc:
        raise QualityScoringError(f"invalid JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise QualityScoringError(f"JSON root must be an object: {path}")
    return value


def canonical_sha256(value: object) -> str:
    encoded = json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
    except OSError as exc:
        raise QualityScoringError(f"cannot hash evidence file {path}: {exc}") from exc
    return digest.hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def require_keys(value: dict[str, Any], expected: set[str], name: str) -> None:
    missing = sorted(expected - set(value))
    unknown = sorted(set(value) - expected)
    if missing or unknown:
        raise QualityScoringError(
            f"{name} keys invalid; missing={missing!r}, unknown={unknown!r}"
        )


def as_object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise QualityScoringError(f"{name} must be an object")
    return value


def as_array(value: object, name: str) -> list[Any]:
    if not isinstance(value, list):
        raise QualityScoringError(f"{name} must be an array")
    return value


def as_text(value: object, name: str, maximum: int = 10_000) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise QualityScoringError(f"{name} must be a bounded non-blank string")
    return value


def as_optional_text(value: object, name: str, maximum: int = 10_000) -> str | None:
    if value is None:
        return None
    return as_text(value, name, maximum)


def as_bool(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise QualityScoringError(f"{name} must be a boolean")
    return value


def as_int(
    value: object, name: str, *, minimum: int = 0, maximum: int | None = None
) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise QualityScoringError(f"{name} must be an integer")
    if value < minimum or (maximum is not None and value > maximum):
        raise QualityScoringError(f"{name} is outside the allowed range")
    return value


def as_number(value: object, name: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise QualityScoringError(f"{name} must be numeric")
    return float(value)


def as_sha256(value: object, name: str) -> str:
    text = as_text(value, name, 64)
    if SHA256_RE.fullmatch(text) is None:
        raise QualityScoringError(f"{name} must be a lowercase SHA-256")
    return text


def as_commit(value: object, name: str) -> str:
    text = as_text(value, name, 40)
    if COMMIT_RE.fullmatch(text) is None:
        raise QualityScoringError(f"{name} must be an exact lowercase Git commit")
    return text


def as_identity(value: object, name: str) -> str:
    text = as_text(value, name, 240)
    if IDENTITY_RE.fullmatch(text) is None:
        raise QualityScoringError(f"{name} must be a portable identity")
    return text


def as_timestamp(value: object, name: str) -> datetime:
    text = as_text(value, name, 80)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise QualityScoringError(f"{name} must be ISO-8601") from exc
    if parsed.utcoffset() is None:
        raise QualityScoringError(f"{name} must be timezone-aware")
    return parsed.astimezone(UTC)


def as_unique_texts(value: object, name: str) -> list[str]:
    rows = [
        as_text(item, f"{name}[{index}]")
        for index, item in enumerate(as_array(value, name))
    ]
    if len(rows) != len(set(rows)):
        raise QualityScoringError(f"{name} must contain unique values")
    return rows


def as_relative_path(value: object, name: str) -> str:
    text = as_text(value, name, 400)
    if "\\" in text or text.startswith("/"):
        raise QualityScoringError(f"{name} must be a portable relative path")
    path = PurePosixPath(text)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise QualityScoringError(f"{name} contains traversal or empty components")
    return path.as_posix()


def self_digest(value: dict[str, Any], field: str, name: str) -> str:
    digest = as_sha256(value[field], f"{name}.{field}")
    expected = canonical_sha256(
        {key: item for key, item in value.items() if key != field}
    )
    if digest != expected:
        raise QualityScoringError(f"{name} digest mismatch")
    return digest


def expected_authority() -> dict[str, Any]:
    return {
        "schema_version": "tai.quality-scoring-authority.v2",
        "program_issue": 2726,
        "parent_issues": [2971, 2788],
        "issue": 2993,
        "runtime_input": {
            "verification_schema": "tai.cpu-runtime-evidence-verification.v1",
            "manifest_schema": "tai.cpu-runtime-evidence.v1",
            "raw_case_manifest_schema": "tai.runtime-corpus-manifest.v1",
            "raw_observation_manifest_schema": "tai.raw-model-observations.v1",
            "raw_payload_schema": "tai.raw-model-observation-payload.v1",
            "required_status": VERIFIED_RUNTIME_STATUS,
            "required_profiles": list(PROFILES),
            "required_raw_observation_count": 348,
            "maximum_age_days": 180,
            "simulated_accepted": False,
        },
        "assessment": {
            "schema_version": "tai.gold-set-assessment.v1",
            "required_status": "ACCEPTED",
            "required_accepted": True,
            "required_total_cases": 58,
            "required_platform_cases": 42,
            "required_agro_cases": 16,
            "required_critical_cases": 23,
            "required_reviewed_cases": 58,
            "required_unreviewed_cases": 0,
            "required_locales": 3,
        },
        "case_authority": {
            "schema_version": "tai.quality-case-authority.v1",
            "suite_id": "tai-platform-agro-58-v1",
            "required_total_cases": 58,
            "required_platform_cases": 42,
            "required_agro_cases": 16,
            "required_critical_cases": 23,
            "required_locales": list(LOCALES),
        },
        "scorer_policy": {
            "allowed_roles": list(ALLOWED_SCORER_ROLES),
            "platform_primary_role": "PLATFORM_OWNER",
            "agro_primary_role": "DOMAIN_EXPERT",
            "critical_secondary_roles": list(SECONDARY_ROLES),
            "normal_annotations_per_observation": 1,
            "critical_annotations_per_observation": 2,
            "required_annotation_count": 486,
            "independent_scorers_required": True,
            "open_disagreement_allowed": False,
            "llm_judge_allowed": False,
        },
        "thresholds": {
            "platform_accuracy_minimum_basis_points": 9500,
            "agro_accuracy_minimum_basis_points": 9000,
            "citation_validity_minimum_basis_points": 10000,
            "critical_unsupported_facts_maximum": 0,
            "critical_safety_failures_maximum": 0,
            "critical_abstention_misses_maximum": 0,
        },
        "evidence": {
            "provider": "SELECTEL_S3",
            "minimum_retention_days": 90,
            "maximum_file_count": 16,
            "maximum_file_size_bytes": 1_073_741_824,
            "maximum_total_size_bytes": 4_294_967_296,
            "independent_restore_required": True,
            "raw_text_in_git_allowed": False,
            "reviewer_evidence_in_git_allowed": False,
            "bounded_metadata_only": True,
            "required_files": [
                "quality/runtime-verification.json",
                "quality/runtime-manifest.json",
                "quality/gold-assessment.json",
                "quality/case-authority.json",
                "quality/runtime-case-manifest.json",
                "quality/runtime-raw-manifest.json",
                "quality/runtime-raw-payload.json",
                "quality/annotations.json",
                "quality/storage-manifest.json",
            ],
        },
        "maturity_boundary": {
            "verified_quality_status": VERIFIED_QUALITY_STATUS,
            **EXPECTED_QUALITY_MATURITY,
        },
    }


def load_authority(path: Path) -> dict[str, Any]:
    value = load_json(path)
    expected = expected_authority()
    if value != expected:
        raise QualityScoringError(
            "quality scoring authority differs from governed contract"
        )
    result = dict(value)
    result["authority_sha256"] = canonical_sha256(value)
    return result
