from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_COMMIT = re.compile(r"^[0-9a-f]{40}$")
_IDENTITY = re.compile(r"^[a-z0-9][a-z0-9.-]{1,79}$")
_ALLOWED_KINDS = {
    "CODE_AUTHORITY",
    "EXTERNAL_EXECUTION",
    "EXTERNAL_ACCOUNT",
    "HUMAN_REVIEW",
    "EXTERNAL_INFRASTRUCTURE",
}


class MatrixError(ValueError):
    pass


def _reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    output: dict[str, Any] = {}
    for key, value in pairs:
        if key in output:
            raise MatrixError(f"duplicate JSON key: {key}")
        output[key] = value
    return output


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicates
        )
    except (OSError, json.JSONDecodeError, MatrixError) as exc:
        raise MatrixError(f"invalid JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise MatrixError(f"JSON root must be an object: {path}")
    return value


def canonical_sha256(value: object) -> str:
    rendered = json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )
    return hashlib.sha256(rendered.encode("utf-8")).hexdigest()


def _require_keys(value: dict[str, Any], expected: set[str], name: str) -> None:
    observed = set(value)
    missing = sorted(expected - observed)
    unknown = sorted(observed - expected)
    if missing or unknown:
        raise MatrixError(
            f"{name} keys invalid; missing={missing!r}, unknown={unknown!r}"
        )


def _object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise MatrixError(f"{name} must be an object")
    return value


def _array(value: object, name: str) -> list[Any]:
    if not isinstance(value, list):
        raise MatrixError(f"{name} must be an array")
    return value


def _text(value: object, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise MatrixError(f"{name} must be a non-blank string")
    return value


def _integer(value: object, name: str, *, minimum: int = 0) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum:
        raise MatrixError(f"{name} must be an integer >= {minimum}")
    return value


def _boolean(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise MatrixError(f"{name} must be a boolean")
    return value


def _identity(value: object, name: str) -> str:
    text = _text(value, name)
    if _IDENTITY.fullmatch(text) is None:
        raise MatrixError(f"{name} must be a portable lowercase identity")
    return text


def _timestamp(value: object, name: str) -> datetime:
    text = _text(value, name)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise MatrixError(f"{name} must be an ISO-8601 timestamp") from exc
    if parsed.utcoffset() is None:
        raise MatrixError(f"{name} must be timezone-aware")
    return parsed.astimezone(UTC)


def _optional_commit(value: object, name: str) -> str | None:
    if value is None:
        return None
    text = _text(value, name)
    if _COMMIT.fullmatch(text) is None:
        raise MatrixError(f"{name} must be an exact lowercase Git commit")
    return text


def _evidence_ref(value: object, name: str) -> str:
    text = _text(value, name)
    valid = (
        text.startswith("https://github.com/pachaninm-lab/pachanin-demo/issues/")
        or text.startswith("repo://pachaninm-lab/pachanin-demo@")
    )
    if not valid or " " in text or "\n" in text:
        raise MatrixError(f"{name} must be a bounded governed evidence reference")
    if text.startswith("repo://"):
        prefix = "repo://pachaninm-lab/pachanin-demo@"
        remainder = text.removeprefix(prefix)
        commit, separator, path = remainder.partition("/")
        if not separator or _COMMIT.fullmatch(commit) is None or not path:
            raise MatrixError(f"{name} repository reference must bind an exact commit")
    return text


def load_authority(path: Path) -> dict[str, Any]:
    raw = load_json(path)
    _require_keys(
        raw,
        {
            "schema_version",
            "program_issue",
            "issue",
            "benchmark_authority_issue",
            "maximum_evidence_age_days",
            "prerequisites",
            "slices",
            "evidence_policy",
            "maturity_boundary",
        },
        "authority",
    )
    if raw["schema_version"] != "tai.benchmark-prerequisite-authority.v1":
        raise MatrixError("unsupported authority schema_version")
    if _integer(raw["program_issue"], "authority.program_issue", minimum=1) != 2726:
        raise MatrixError("authority program issue mismatch")
    if _integer(raw["issue"], "authority.issue", minimum=1) != 2974:
        raise MatrixError("authority issue mismatch")
    if (
        _integer(
            raw["benchmark_authority_issue"],
            "authority.benchmark_authority_issue",
            minimum=1,
        )
        != 2862
    ):
        raise MatrixError("benchmark authority issue mismatch")
    maximum_age = _integer(
        raw["maximum_evidence_age_days"],
        "authority.maximum_evidence_age_days",
        minimum=1,
    )

    prerequisites: list[dict[str, Any]] = []
    prerequisite_ids: set[str] = set()
    for index, raw_item in enumerate(_array(raw["prerequisites"], "prerequisites")):
        name = f"prerequisites[{index}]"
        item = _object(raw_item, name)
        _require_keys(item, {"id", "owner_issue", "kind", "required_status"}, name)
        prerequisite_id = _identity(item["id"], f"{name}.id")
        if prerequisite_id in prerequisite_ids:
            raise MatrixError("prerequisite ids must be unique")
        prerequisite_ids.add(prerequisite_id)
        kind = _text(item["kind"], f"{name}.kind")
        if kind not in _ALLOWED_KINDS:
            raise MatrixError(f"{name}.kind is unsupported")
        prerequisites.append(
            {
                "id": prerequisite_id,
                "owner_issue": _integer(
                    item["owner_issue"], f"{name}.owner_issue", minimum=1
                ),
                "kind": kind,
                "required_status": _text(
                    item["required_status"], f"{name}.required_status"
                ),
            }
        )

    slices: list[dict[str, Any]] = []
    slice_ids: set[str] = set()
    for index, raw_item in enumerate(_array(raw["slices"], "slices")):
        name = f"slices[{index}]"
        item = _object(raw_item, name)
        _require_keys(
            item, {"id", "required_prerequisites", "ready_status"}, name
        )
        slice_id = _identity(item["id"], f"{name}.id")
        if slice_id in slice_ids:
            raise MatrixError("slice ids must be unique")
        slice_ids.add(slice_id)
        required = [
            _identity(value, f"{name}.required_prerequisites")
            for value in _array(
                item["required_prerequisites"], f"{name}.required_prerequisites"
            )
        ]
        if not required or len(required) != len(set(required)):
            raise MatrixError(f"{name}.required_prerequisites must be non-empty unique")
        unknown = sorted(set(required) - prerequisite_ids)
        if unknown:
            raise MatrixError(f"{name} references unknown prerequisites: {unknown!r}")
        slices.append(
            {
                "id": slice_id,
                "required_prerequisites": required,
                "ready_status": _text(item["ready_status"], f"{name}.ready_status"),
            }
        )

    policy = _object(raw["evidence_policy"], "evidence_policy")
    _require_keys(
        policy,
        {
            "exact_commit_required_for_code_authority",
            "external_evidence_reference_required",
            "timezone_aware_observed_at_required",
            "simulation_accepted",
            "pending_accepted",
            "self_attestation_accepted_for_human_review",
        },
        "evidence_policy",
    )
    parsed_policy = {key: _boolean(policy[key], f"evidence_policy.{key}") for key in policy}
    expected_policy = {
        "exact_commit_required_for_code_authority": True,
        "external_evidence_reference_required": True,
        "timezone_aware_observed_at_required": True,
        "simulation_accepted": False,
        "pending_accepted": False,
        "self_attestation_accepted_for_human_review": False,
    }
    if parsed_policy != expected_policy:
        raise MatrixError("evidence policy weakens the fail-closed boundary")

    maturity = _object(raw["maturity_boundary"], "maturity_boundary")
    expected_maturity = {
        "benchmark_status": "PENDING_BENCHMARK",
        "model_admission_status": "PENDING_ADMISSION",
        "production_operational_status": "NOT_ATTESTED",
    }
    if maturity != expected_maturity:
        raise MatrixError("maturity boundary is invalid")

    authority: dict[str, Any] = {
        "schema_version": raw["schema_version"],
        "program_issue": 2726,
        "issue": 2974,
        "benchmark_authority_issue": 2862,
        "maximum_evidence_age_days": maximum_age,
        "prerequisites": prerequisites,
        "slices": slices,
        "evidence_policy": parsed_policy,
        "maturity_boundary": maturity,
    }
    authority["authority_sha256"] = canonical_sha256(authority)
    return authority


def load_observation(path: Path) -> dict[str, Any]:
    raw = load_json(path)
    _require_keys(
        raw,
        {
            "schema_version",
            "observed_at",
            "observations",
            "benchmark_status",
            "model_admission_status",
            "production_operational_status",
        },
        "observation",
    )
    if raw["schema_version"] != "tai.benchmark-prerequisite-observation.v1":
        raise MatrixError("unsupported observation schema_version")
    observations: list[dict[str, Any]] = []
    observed_ids: set[str] = set()
    for index, raw_item in enumerate(_array(raw["observations"], "observations")):
        name = f"observations[{index}]"
        item = _object(raw_item, name)
        _require_keys(
            item,
            {"id", "owner_issue", "status", "evidence_ref", "exact_commit", "simulated"},
            name,
        )
        item_id = _identity(item["id"], f"{name}.id")
        if item_id in observed_ids:
            raise MatrixError("observation ids must be unique")
        observed_ids.add(item_id)
        observations.append(
            {
                "id": item_id,
                "owner_issue": _integer(
                    item["owner_issue"], f"{name}.owner_issue", minimum=1
                ),
                "status": _text(item["status"], f"{name}.status"),
                "evidence_ref": _evidence_ref(
                    item["evidence_ref"], f"{name}.evidence_ref"
                ),
                "exact_commit": _optional_commit(
                    item["exact_commit"], f"{name}.exact_commit"
                ),
                "simulated": _boolean(item["simulated"], f"{name}.simulated"),
            }
        )
    maturity = {
        "benchmark_status": raw["benchmark_status"],
        "model_admission_status": raw["model_admission_status"],
        "production_operational_status": raw["production_operational_status"],
    }
    expected_maturity = {
        "benchmark_status": "PENDING_BENCHMARK",
        "model_admission_status": "PENDING_ADMISSION",
        "production_operational_status": "NOT_ATTESTED",
    }
    if maturity != expected_maturity:
        raise MatrixError("observation maturity boundary is invalid")
    return {
        "schema_version": raw["schema_version"],
        "observed_at": _timestamp(raw["observed_at"], "observation.observed_at"),
        "observations": observations,
        **maturity,
    }


def evaluate_matrix(
    authority_path: Path,
    observation_path: Path,
    *,
    evaluated_at: datetime | None = None,
) -> dict[str, object]:
    authority = load_authority(authority_path)
    observation = load_observation(observation_path)
    now = (evaluated_at or datetime.now(UTC)).astimezone(UTC)
    observed_at = observation["observed_at"]
    if not isinstance(observed_at, datetime):
        raise MatrixError("observation timestamp type is invalid")
    if observed_at > now + timedelta(minutes=5):
        raise MatrixError("observation timestamp is in the future")
    stale = now - observed_at > timedelta(days=authority["maximum_evidence_age_days"])

    plans = {item["id"]: item for item in authority["prerequisites"]}
    observed = {item["id"]: item for item in observation["observations"]}
    if set(plans) != set(observed):
        missing = sorted(set(plans) - set(observed))
        unknown = sorted(set(observed) - set(plans))
        raise MatrixError(
            f"observation coverage invalid; missing={missing!r}, unknown={unknown!r}"
        )

    prerequisite_results: dict[str, dict[str, object]] = {}
    for prerequisite_id, plan in plans.items():
        value = observed[prerequisite_id]
        if value["owner_issue"] != plan["owner_issue"]:
            raise MatrixError(f"owner issue mismatch for {prerequisite_id}")
        if plan["kind"] == "CODE_AUTHORITY" and value["exact_commit"] is None:
            raise MatrixError(f"exact commit missing for {prerequisite_id}")
        satisfied = (
            not stale
            and value["simulated"] is False
            and value["status"] == plan["required_status"]
        )
        prerequisite_results[prerequisite_id] = {
            "satisfied": satisfied,
            "required_status": plan["required_status"],
            "observed_status": value["status"],
            "owner_issue": plan["owner_issue"],
            "kind": plan["kind"],
            "evidence_ref": value["evidence_ref"],
            "exact_commit": value["exact_commit"],
            "simulated": value["simulated"],
        }

    slice_results: dict[str, dict[str, object]] = {}
    reasons: list[str] = []
    for slice_plan in authority["slices"]:
        blockers = [
            prerequisite_id
            for prerequisite_id in slice_plan["required_prerequisites"]
            if not prerequisite_results[prerequisite_id]["satisfied"]
        ]
        ready = not blockers
        slice_results[slice_plan["id"]] = {
            "status": slice_plan["ready_status"] if ready else "BLOCKED",
            "ready": ready,
            "blockers": blockers,
        }
        for prerequisite_id in blockers:
            result = prerequisite_results[prerequisite_id]
            reasons.append(
                f"{slice_plan['id']}:{prerequisite_id}:"
                f"expected={result['required_status']}:observed={result['observed_status']}"
            )

    joint_ready = bool(slice_results["joint-model-admission"]["ready"])
    report: dict[str, object] = {
        "schema_version": "tai.benchmark-prerequisite-report.v1",
        "status": "READY_FOR_JOINT_MODEL_ADMISSION" if joint_ready else "BLOCKED",
        "authority_sha256": authority["authority_sha256"],
        "observation_sha256": canonical_sha256(
            {
                **observation,
                "observed_at": observed_at.isoformat(),
            }
        ),
        "observed_at": observed_at.isoformat(),
        "evaluated_at": now.isoformat(),
        "stale": stale,
        "prerequisites": prerequisite_results,
        "slices": slice_results,
        "reasons": sorted(set(reasons)),
        "benchmark_status": "PENDING_BENCHMARK",
        "model_admission_status": "PENDING_ADMISSION",
        "production_operational_status": "NOT_ATTESTED",
    }
    report["report_sha256"] = canonical_sha256(report)
    return report


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
