from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Any

_SCHEMA = "tai.production-bootstrap-authority.v1"
_MODEL_EVIDENCE_SCHEMA = "tai.restricted-model-artifact.v1"
_MODEL_ID = "tai-qwen3-8b-q4km"
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_GIT_SHA = re.compile(r"^[0-9a-f]{40}$")
_HOST = re.compile(r"^[A-Za-z0-9.-]{1,253}$")

_SOURCE_ID = "tai-agro-os-master-spec-v4.0"
_SOURCE_REFERENCE = "TAI_Agro_OS_Master_Specification_v4.0.docx"
_SOURCE_TEXT = """TAI Agro OS Master Specification v4.0

RU: TAI Agro OS — самостоятельная коммерческая ИИ-платформа для растениеводства, животноводства, сельхозтехники и агробизнеса. Production-развёртывание выполняется только на существующей инфраструктуре REG.RU, без новых регулярных расходов, с локальной моделью Qwen3-8B и поддержкой русского, английского и китайского языков. Production PASS запрещено объявлять без exact-main deployment и live acceptance.

EN: TAI Agro OS is a standalone commercial AI platform for crop production, livestock, agricultural machinery and agribusiness. Production deployment uses only the existing REG.RU infrastructure, creates no new recurring expenses, uses the local Qwen3-8B model, and supports Russian, English and Chinese. Production PASS must not be claimed without exact-main deployment and live acceptance.

ZH: TAI Agro OS 是面向种植业、畜牧业、农业机械和农业经营的独立商业人工智能平台。生产部署仅使用现有 REG.RU 基础设施，不新增经常性费用，采用本地 Qwen3-8B 模型，并支持俄语、英语和中文。未完成 exact-main 部署和在线验收时，不得宣称 Production PASS。"""


class ProductionBootstrapAuthorityError(ValueError):
    """Raised when exact production bootstrap evidence is incomplete or unsafe."""


@dataclass(frozen=True, slots=True)
class RestrictedModelArtifactEvidence:
    model_identity: str
    model_host: str
    artifact_path: str
    artifact_sha256: str
    artifact_size_bytes: int
    maximum_context_tokens: int

    def __post_init__(self) -> None:
        if self.model_identity != _MODEL_ID:
            raise ProductionBootstrapAuthorityError("restricted model identity mismatch")
        if _HOST.fullmatch(self.model_host) is None:
            raise ProductionBootstrapAuthorityError("restricted model host is invalid")
        path = PurePosixPath(self.artifact_path)
        if not path.is_absolute() or ".." in path.parts:
            raise ProductionBootstrapAuthorityError("model artifact path must be absolute")
        if _SHA256.fullmatch(self.artifact_sha256) is None:
            raise ProductionBootstrapAuthorityError("model artifact SHA-256 is invalid")
        if self.artifact_size_bytes < 1:
            raise ProductionBootstrapAuthorityError("model artifact size must be positive")
        if not 512 <= self.maximum_context_tokens <= 262_144:
            raise ProductionBootstrapAuthorityError("model context bound is invalid")

    @property
    def revision(self) -> str:
        return f"artifact-{self.artifact_sha256}"

    @property
    def artifact_locator(self) -> str:
        return f"file://{self.model_host}{self.artifact_path}"

    @classmethod
    def from_json_object(cls, value: object) -> RestrictedModelArtifactEvidence:
        if not isinstance(value, dict):
            raise ProductionBootstrapAuthorityError("model evidence must be an object")
        if value.get("schemaVersion") != _MODEL_EVIDENCE_SCHEMA:
            raise ProductionBootstrapAuthorityError("model evidence schema is invalid")
        return cls(
            model_identity=_string(value, "modelIdentity"),
            model_host=_string(value, "modelHost"),
            artifact_path=_string(value, "artifactPath"),
            artifact_sha256=_string(value, "artifactSha256"),
            artifact_size_bytes=_integer(value, "artifactSizeBytes"),
            maximum_context_tokens=_integer(value, "maximumContextTokens"),
        )


@dataclass(frozen=True, slots=True)
class ProductionBootstrapAuthority:
    activation_sha: str
    model: RestrictedModelArtifactEvidence

    def __post_init__(self) -> None:
        if _GIT_SHA.fullmatch(self.activation_sha) is None:
            raise ProductionBootstrapAuthorityError("activation SHA is invalid")

    def to_json_object(self) -> dict[str, object]:
        source_checksum = hashlib.sha256(_SOURCE_TEXT.encode()).hexdigest()
        payload: dict[str, object] = {
            "schemaVersion": _SCHEMA,
            "activationSha": self.activation_sha,
            "model": {
                "modelId": self.model.model_identity,
                "revision": self.model.revision,
                "artifactLocator": self.model.artifact_locator,
                "artifactSha256": self.model.artifact_sha256,
                "artifactSizeBytes": self.model.artifact_size_bytes,
                "maximumContextTokens": self.model.maximum_context_tokens,
                "maximumOutputTokens": min(2_048, self.model.maximum_context_tokens),
                "licenseRef": "Apache-2.0",
                "quantization": "Q4_K_M",
                "runtimeClass": "CPU",
                "capabilities": [
                    "RUSSIAN",
                    "STRUCTURED_OUTPUT",
                    "TEXT_GENERATION",
                ],
                "permanentAdmissionStatus": "NOT_ATTESTED",
                "restrictedOperational": True,
            },
            "knowledge": {
                "sourceId": _SOURCE_ID,
                "sourceReference": _SOURCE_REFERENCE,
                "documentChecksumSha256": source_checksum,
                "chunkId": f"{_SOURCE_ID}:foundation:0",
                "ordinal": 0,
                "trustScore": "1.000000",
                "text": _SOURCE_TEXT,
            },
            "newRecurringCostRub": 0,
            "productionHosting": "REG_RU_VPS_ONLY",
        }
        payload["authoritySha256"] = _canonical_sha256(payload)
        return payload


def build_authority(
    *,
    activation_sha: str,
    model_evidence: object,
) -> dict[str, object]:
    return ProductionBootstrapAuthority(
        activation_sha=activation_sha,
        model=RestrictedModelArtifactEvidence.from_json_object(model_evidence),
    ).to_json_object()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build exact restricted-model and source-backed TAI bootstrap authority"
    )
    parser.add_argument("--activation-sha", required=True)
    parser.add_argument("--model-evidence", required=True)
    args = parser.parse_args()
    with open(args.model_evidence, encoding="utf-8") as stream:
        evidence = json.load(stream)
    result = build_authority(
        activation_sha=args.activation_sha,
        model_evidence=evidence,
    )
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
    return 0


def _canonical_sha256(value: object) -> str:
    return hashlib.sha256(
        json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    ).hexdigest()


def _string(value: dict[str, Any], key: str) -> str:
    item = value.get(key)
    if not isinstance(item, str) or not item.strip():
        raise ProductionBootstrapAuthorityError(f"{key} must be a non-blank string")
    return item.strip()


def _integer(value: dict[str, Any], key: str) -> int:
    item = value.get(key)
    if not isinstance(item, int) or isinstance(item, bool):
        raise ProductionBootstrapAuthorityError(f"{key} must be an integer")
    return item


if __name__ == "__main__":
    raise SystemExit(main())
