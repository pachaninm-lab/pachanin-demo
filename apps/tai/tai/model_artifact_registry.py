from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path, PurePosixPath
from typing import Any, cast

from tai.model_runtime import ModelRuntimeClass

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_REVISION = re.compile(r"^[0-9a-f]{40,64}$")
_IDENTITY = re.compile(r"^[A-Za-z0-9._:/+-]{1,180}$")
_RELEASE_TAG = re.compile(r"^[A-Za-z0-9._+-]{1,80}$")


class CandidateRole(StrEnum):
    PRIMARY = "PRIMARY"
    FALLBACK = "FALLBACK"


class LicenseReviewStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class BundleVerificationStatus(StrEnum):
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


@dataclass(frozen=True, slots=True)
class QuantizationRecipe:
    runtime_class: ModelRuntimeClass
    format: str
    quantization: str
    toolchain_name: str
    toolchain_uri: str
    toolchain_release: str
    toolchain_commit: str | None
    output_path: str

    def __post_init__(self) -> None:
        if self.format != "GGUF":
            raise ValueError("only GGUF artifacts are permitted in AP-13B")
        _identity(self.quantization, "quantization")
        _identity(self.toolchain_name, "toolchain_name")
        _https(self.toolchain_uri, "toolchain_uri")
        if _RELEASE_TAG.fullmatch(self.toolchain_release) is None:
            raise ValueError("toolchain_release must be a portable immutable tag")
        if self.toolchain_commit is not None:
            _revision(self.toolchain_commit, "toolchain_commit")
        _relative_path(self.output_path, "output_path")


@dataclass(frozen=True, slots=True)
class ModelSourceCandidate:
    role: CandidateRole
    model_id: str
    revision: str
    source_uri: str
    model_card_uri: str
    license_spdx: str
    license_review_status: LicenseReviewStatus
    license_text_path: str | None
    tokenizer_files: tuple[str, ...]
    weight_files: tuple[str, ...]
    recipes: tuple[QuantizationRecipe, ...]

    def __post_init__(self) -> None:
        _identity(self.model_id, "model_id")
        _revision(self.revision, "revision")
        _https(self.source_uri, "source_uri")
        _https(self.model_card_uri, "model_card_uri")
        if self.revision not in self.source_uri:
            raise ValueError("source_uri must contain the exact source revision")
        if self.revision not in self.model_card_uri:
            raise ValueError("model_card_uri must contain the exact source revision")
        _identity(self.license_spdx, "license_spdx")
        if (
            self.license_review_status is LicenseReviewStatus.APPROVED
            and self.license_text_path is None
        ):
            raise ValueError("approved license requires license_text_path")
        if self.license_text_path is not None:
            _relative_path(self.license_text_path, "license_text_path")
        _unique_paths(self.tokenizer_files, "tokenizer_files")
        _unique_paths(self.weight_files, "weight_files")
        if not self.recipes:
            raise ValueError("at least one quantization recipe is required")
        outputs = tuple(recipe.output_path for recipe in self.recipes)
        if len(outputs) != len(set(outputs)):
            raise ValueError("quantization recipe output paths must be unique")
        if not any(
            recipe.runtime_class is ModelRuntimeClass.CPU
            for recipe in self.recipes
        ):
            raise ValueError("every model candidate requires a CPU recipe")


@dataclass(frozen=True, slots=True)
class ModelCandidateRegistry:
    candidates: tuple[ModelSourceCandidate, ...]

    def __post_init__(self) -> None:
        if not self.candidates:
            raise ValueError("candidate registry must not be empty")
        identities = {(item.model_id, item.revision) for item in self.candidates}
        if len(identities) != len(self.candidates):
            raise ValueError("model candidate identities must be unique")
        roles = tuple(item.role for item in self.candidates)
        if roles.count(CandidateRole.PRIMARY) != 1:
            raise ValueError("candidate registry requires exactly one primary model")
        if CandidateRole.FALLBACK not in roles:
            raise ValueError("candidate registry requires at least one fallback model")


@dataclass(frozen=True, slots=True)
class DeclaredFile:
    path: str
    sha256: str
    size_bytes: int

    def __post_init__(self) -> None:
        _relative_path(self.path, "declared file path")
        _sha256(self.sha256, "declared file sha256")
        if self.size_bytes < 1:
            raise ValueError("declared file size must be positive")


@dataclass(frozen=True, slots=True)
class DeclaredArtifact:
    path: str
    sha256: str
    size_bytes: int
    runtime_class: ModelRuntimeClass
    quantization: str
    toolchain_commit: str

    def __post_init__(self) -> None:
        _relative_path(self.path, "artifact path")
        _sha256(self.sha256, "artifact sha256")
        if self.size_bytes < 1:
            raise ValueError("artifact size must be positive")
        _identity(self.quantization, "artifact quantization")
        _revision(self.toolchain_commit, "artifact toolchain_commit")


@dataclass(frozen=True, slots=True)
class LocalModelArtifactBundle:
    model_id: str
    revision: str
    license_text: DeclaredFile
    tokenizers: tuple[DeclaredFile, ...]
    artifacts: tuple[DeclaredArtifact, ...]

    def __post_init__(self) -> None:
        _identity(self.model_id, "bundle model_id")
        _revision(self.revision, "bundle revision")
        if not self.tokenizers or not self.artifacts:
            raise ValueError("bundle tokenizers and artifacts must not be empty")
        paths = (
            self.license_text.path,
            *(item.path for item in self.tokenizers),
            *(item.path for item in self.artifacts),
        )
        if len(paths) != len(set(paths)):
            raise ValueError("bundle file paths must be unique")


@dataclass(frozen=True, slots=True)
class BundleVerificationReport:
    model_id: str
    revision: str
    status: BundleVerificationStatus
    reasons: tuple[str, ...]
    verified_files: tuple[str, ...]
    report_sha256: str

    @property
    def verified(self) -> bool:
        return self.status is BundleVerificationStatus.VERIFIED


def load_candidate_registry(path: Path) -> ModelCandidateRegistry:
    payload = _load(path)
    if payload.get("schema_version") != "tai.model-candidate-registry.v1":
        raise ValueError("unsupported model candidate registry schema")
    candidates = tuple(
        _candidate(item) for item in _array(payload, "candidates")
    )
    return ModelCandidateRegistry(candidates)


def load_artifact_bundle(path: Path) -> LocalModelArtifactBundle:
    payload = _load(path)
    if payload.get("schema_version") != "tai.local-model-artifact-bundle.v1":
        raise ValueError("unsupported local artifact bundle schema")
    return LocalModelArtifactBundle(
        model_id=_string(payload, "model_id"),
        revision=_string(payload, "revision"),
        license_text=_declared_file(payload.get("license_text")),
        tokenizers=tuple(
            _declared_file(item) for item in _array(payload, "tokenizers")
        ),
        artifacts=tuple(
            _declared_artifact(item) for item in _array(payload, "artifacts")
        ),
    )


def verify_artifact_bundle(
    *,
    registry: ModelCandidateRegistry,
    bundle: LocalModelArtifactBundle,
    bundle_root: Path,
) -> BundleVerificationReport:
    candidate = next(
        (
            item
            for item in registry.candidates
            if (item.model_id, item.revision) == (bundle.model_id, bundle.revision)
        ),
        None,
    )
    reasons: list[str] = []
    verified: list[str] = []
    if candidate is None:
        reasons.append("CANDIDATE_NOT_REGISTERED")
    else:
        _verify_candidate_contract(candidate, bundle, reasons)

    declared_files: tuple[DeclaredFile | DeclaredArtifact, ...] = (
        bundle.license_text,
        *bundle.tokenizers,
        *bundle.artifacts,
    )
    for declared in declared_files:
        path = _bounded_file(bundle_root, declared.path)
        if not path.is_file():
            reasons.append(f"FILE_MISSING:{declared.path}")
        elif path.stat().st_size != declared.size_bytes:
            reasons.append(f"FILE_SIZE_MISMATCH:{declared.path}")
        elif _file_sha256(path) != declared.sha256:
            reasons.append(f"FILE_SHA256_MISMATCH:{declared.path}")
        else:
            verified.append(declared.path)

    unique_reasons = tuple(sorted(set(reasons)))
    status = (
        BundleVerificationStatus.VERIFIED
        if not unique_reasons
        else BundleVerificationStatus.REJECTED
    )
    verified_files = tuple(sorted(verified))
    return BundleVerificationReport(
        model_id=bundle.model_id,
        revision=bundle.revision,
        status=status,
        reasons=unique_reasons,
        verified_files=verified_files,
        report_sha256=_report_sha256(
            bundle.model_id,
            bundle.revision,
            status,
            unique_reasons,
            verified_files,
        ),
    )


def registry_to_canonical_json(registry: ModelCandidateRegistry) -> str:
    payload = {
        "candidates": [_candidate_payload(item) for item in registry.candidates],
        "schema_version": "tai.model-candidate-registry.v1",
    }
    return _canonical_json(payload)


def _verify_candidate_contract(
    candidate: ModelSourceCandidate,
    bundle: LocalModelArtifactBundle,
    reasons: list[str],
) -> None:
    if candidate.license_review_status is not LicenseReviewStatus.APPROVED:
        reasons.append("LICENSE_REVIEW_NOT_APPROVED")
    if candidate.license_text_path != bundle.license_text.path:
        reasons.append("LICENSE_TEXT_PATH_MISMATCH")
    if set(candidate.tokenizer_files) != {item.path for item in bundle.tokenizers}:
        reasons.append("TOKENIZER_SET_MISMATCH")
    expected = {
        (
            item.output_path,
            item.runtime_class,
            item.quantization,
            item.toolchain_commit,
        )
        for item in candidate.recipes
    }
    declared = {
        (
            item.path,
            item.runtime_class,
            item.quantization,
            item.toolchain_commit,
        )
        for item in bundle.artifacts
    }
    if expected != declared:
        reasons.append("ARTIFACT_RECIPE_SET_MISMATCH")
    if any(item.toolchain_commit is None for item in candidate.recipes):
        reasons.append("TOOLCHAIN_FULL_COMMIT_MISSING")


def _candidate_payload(candidate: ModelSourceCandidate) -> dict[str, object]:
    return {
        "license_review_status": candidate.license_review_status.value,
        "license_spdx": candidate.license_spdx,
        "license_text_path": candidate.license_text_path,
        "model_card_uri": candidate.model_card_uri,
        "model_id": candidate.model_id,
        "quantization_recipes": [
            {
                "format": recipe.format,
                "output_path": recipe.output_path,
                "quantization": recipe.quantization,
                "runtime_class": recipe.runtime_class.value,
                "toolchain_commit": recipe.toolchain_commit,
                "toolchain_name": recipe.toolchain_name,
                "toolchain_release": recipe.toolchain_release,
                "toolchain_uri": recipe.toolchain_uri,
            }
            for recipe in candidate.recipes
        ],
        "revision": candidate.revision,
        "role": candidate.role.value,
        "source_uri": candidate.source_uri,
        "tokenizer_files": list(candidate.tokenizer_files),
        "weight_files": list(candidate.weight_files),
    }


def _candidate(value: object) -> ModelSourceCandidate:
    payload = _object(value, "candidate")
    return ModelSourceCandidate(
        role=CandidateRole(_string(payload, "role")),
        model_id=_string(payload, "model_id"),
        revision=_string(payload, "revision"),
        source_uri=_string(payload, "source_uri"),
        model_card_uri=_string(payload, "model_card_uri"),
        license_spdx=_string(payload, "license_spdx"),
        license_review_status=LicenseReviewStatus(
            _string(payload, "license_review_status")
        ),
        license_text_path=_optional_string(payload, "license_text_path"),
        tokenizer_files=tuple(_strings(payload, "tokenizer_files")),
        weight_files=tuple(_strings(payload, "weight_files")),
        recipes=tuple(
            _recipe(item) for item in _array(payload, "quantization_recipes")
        ),
    )


def _recipe(value: object) -> QuantizationRecipe:
    payload = _object(value, "quantization recipe")
    return QuantizationRecipe(
        runtime_class=ModelRuntimeClass(_string(payload, "runtime_class")),
        format=_string(payload, "format"),
        quantization=_string(payload, "quantization"),
        toolchain_name=_string(payload, "toolchain_name"),
        toolchain_uri=_string(payload, "toolchain_uri"),
        toolchain_release=_string(payload, "toolchain_release"),
        toolchain_commit=_optional_string(payload, "toolchain_commit"),
        output_path=_string(payload, "output_path"),
    )


def _declared_file(value: object) -> DeclaredFile:
    payload = _object(value, "declared file")
    return DeclaredFile(
        path=_string(payload, "path"),
        sha256=_string(payload, "sha256"),
        size_bytes=_integer(payload, "size_bytes"),
    )


def _declared_artifact(value: object) -> DeclaredArtifact:
    payload = _object(value, "declared artifact")
    return DeclaredArtifact(
        path=_string(payload, "path"),
        sha256=_string(payload, "sha256"),
        size_bytes=_integer(payload, "size_bytes"),
        runtime_class=ModelRuntimeClass(_string(payload, "runtime_class")),
        quantization=_string(payload, "quantization"),
        toolchain_commit=_string(payload, "toolchain_commit"),
    )


def _report_sha256(
    model_id: str,
    revision: str,
    status: BundleVerificationStatus,
    reasons: tuple[str, ...],
    verified_files: tuple[str, ...],
) -> str:
    payload = {
        "model_id": model_id,
        "reasons": list(reasons),
        "revision": revision,
        "schema_version": "tai.model-artifact-verification-report.v1",
        "status": status.value,
        "verified_files": list(verified_files),
    }
    return hashlib.sha256(_canonical_json(payload).encode()).hexdigest()


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _bounded_file(root: Path, relative_path: str) -> Path:
    resolved_root = root.resolve()
    candidate = (resolved_root / relative_path).resolve()
    if candidate != resolved_root and resolved_root not in candidate.parents:
        raise ValueError("bundle file escapes bundle root")
    return candidate


def _load(path: Path) -> dict[str, Any]:
    try:
        return _object(json.loads(path.read_text(encoding="utf-8")), "root payload")
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot load JSON from {path}") from error


def _object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be a JSON object")
    if any(not isinstance(key, str) for key in value):
        raise ValueError(f"{name} keys must be strings")
    return cast(dict[str, Any], value)


def _array(payload: dict[str, Any], key: str) -> list[object]:
    value = payload.get(key)
    if not isinstance(value, list):
        raise ValueError(f"{key} must be an array")
    return cast(list[object], value)


def _strings(payload: dict[str, Any], key: str) -> list[str]:
    values = _array(payload, key)
    if not values or any(not isinstance(item, str) for item in values):
        raise ValueError(f"{key} must be a non-empty string array")
    return cast(list[str], values)


def _string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return value


def _optional_string(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be null or a non-empty string")
    return value


def _integer(payload: dict[str, Any], key: str) -> int:
    value = payload.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{key} must be an integer")
    return value


def _canonical_json(payload: object) -> str:
    return json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _identity(value: str, name: str) -> None:
    if _IDENTITY.fullmatch(value) is None:
        raise ValueError(f"{name} must be a portable bounded identity")


def _revision(value: str, name: str) -> None:
    if _REVISION.fullmatch(value) is None:
        raise ValueError(f"{name} must be a pinned lowercase commit digest")


def _sha256(value: str, name: str) -> None:
    if _SHA256.fullmatch(value) is None:
        raise ValueError(f"{name} must be a lowercase SHA-256 digest")


def _https(value: str, name: str) -> None:
    if not value.startswith("https://"):
        raise ValueError(f"{name} must use HTTPS")


def _relative_path(value: str, name: str) -> None:
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or value.startswith("./"):
        raise ValueError(f"{name} must be a bounded relative path")
    if not path.parts or any(part in {"", "."} for part in path.parts):
        raise ValueError(f"{name} must be a bounded relative path")


def _unique_paths(values: tuple[str, ...], name: str) -> None:
    if not values:
        raise ValueError(f"{name} must not be empty")
    for value in values:
        _relative_path(value, name)
    if len(values) != len(set(values)):
        raise ValueError(f"{name} must contain unique paths")
