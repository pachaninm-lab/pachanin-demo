from __future__ import annotations

from typing import Any

from tai.cpu_runtime_contract import (
    RuntimeEvidenceError,
    as_array,
    as_commit,
    as_identity,
    as_object,
    as_relative_path,
    as_sha256,
    as_text,
    require_keys,
)


def parse_bundle_finalization(
    value: object, plans: list[dict[str, Any]]
) -> tuple[dict[str, Any], list[str]]:
    root = as_object(value, "bundle_finalization")
    require_keys(
        root,
        {"schema_version", "status", "report_sha256", "models"},
        "bundle_finalization",
    )
    expected = {str(plan["model_key"]): plan for plan in plans}
    raw_models = as_array(root["models"], "bundle_finalization.models")
    if len(raw_models) != len(expected):
        raise RuntimeEvidenceError(
            "bundle finalization must contain exactly two models"
        )
    model_keys = {
        "model_key",
        "role",
        "model_id",
        "revision",
        "archive_sha256",
        "version_id",
        "immutable_locator",
        "verification_status",
        "verification_report_sha256",
        "artifact_path",
        "artifact_sha256",
    }
    parsed_models: list[dict[str, Any]] = []
    reasons: list[str] = []
    seen: set[str] = set()
    for index, raw_model in enumerate(raw_models):
        name = f"bundle_finalization.models[{index}]"
        model = as_object(raw_model, name)
        require_keys(model, model_keys, name)
        model_key = as_identity(model["model_key"], f"{name}.model_key")
        if model_key in seen:
            raise RuntimeEvidenceError("bundle model keys must be unique")
        seen.add(model_key)
        plan = expected.get(model_key)
        if plan is None:
            raise RuntimeEvidenceError(f"unexpected bundle model: {model_key}")
        archive_sha = as_sha256(
            model["archive_sha256"], f"{name}.archive_sha256"
        )
        locator = as_text(
            model["immutable_locator"], f"{name}.immutable_locator"
        )
        parsed: dict[str, Any] = {
            "model_key": model_key,
            "role": as_text(model["role"], f"{name}.role"),
            "model_id": as_identity(model["model_id"], f"{name}.model_id"),
            "revision": as_commit(model["revision"], f"{name}.revision"),
            "archive_sha256": archive_sha,
            "version_id": as_text(model["version_id"], f"{name}.version_id"),
            "immutable_locator": locator,
            "verification_status": as_text(
                model["verification_status"], f"{name}.verification_status"
            ),
            "verification_report_sha256": as_sha256(
                model["verification_report_sha256"],
                f"{name}.verification_report_sha256",
            ),
            "artifact_path": as_relative_path(
                model["artifact_path"], f"{name}.artifact_path"
            ),
            "artifact_sha256": as_sha256(
                model["artifact_sha256"], f"{name}.artifact_sha256"
            ),
        }
        for field in ("role", "model_id", "revision", "artifact_path"):
            if parsed[field] != plan[field]:
                reasons.append(
                    f"BUNDLE_MODEL_BINDING_MISMATCH:{model_key}:{field}"
                )
        if parsed["verification_status"] != "VERIFIED":
            reasons.append(f"BUNDLE_NOT_VERIFIED:{model_key}")
        if (
            not locator.startswith("s3+version://")
            or "versionId=" not in locator
            or f"#sha256={archive_sha}" not in locator
        ):
            reasons.append(f"BUNDLE_LOCATOR_NOT_IMMUTABLE:{model_key}")
        parsed_models.append(parsed)
    if seen != set(expected):
        raise RuntimeEvidenceError("bundle model coverage is incomplete")
    schema = as_text(
        root["schema_version"], "bundle_finalization.schema_version"
    )
    status = as_text(root["status"], "bundle_finalization.status")
    if schema != "tai.model-bundle-finalization-report.v1":
        reasons.append("BUNDLE_FINALIZATION_SCHEMA_MISMATCH")
    if status != "BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED":
        reasons.append("BUNDLE_FINALIZATION_NOT_ACCEPTED")
    return {
        "schema_version": schema,
        "status": status,
        "report_sha256": as_sha256(
            root["report_sha256"], "bundle_finalization.report_sha256"
        ),
        "models": parsed_models,
    }, reasons
