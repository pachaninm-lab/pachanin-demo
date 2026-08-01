from __future__ import annotations

import hashlib
import json

import pytest

from tai.bootstrap_authority import (
    ProductionBootstrapAuthorityError,
    build_authority,
)

ACTIVATION_SHA = "b" * 40
ARTIFACT_SHA256 = "a" * 64


def _evidence() -> dict[str, object]:
    return {
        "schemaVersion": "tai.restricted-model-artifact.v1",
        "modelIdentity": "tai-qwen3-8b-q4km",
        "modelHost": "192.168.0.206",
        "artifactPath": "/srv/tai-models/qwen3-8b-q4-k-m.gguf",
        "artifactSha256": ARTIFACT_SHA256,
        "artifactSizeBytes": 4_967_000_000,
        "maximumContextTokens": 8_192,
    }


def test_bootstrap_authority_is_deterministic_and_honest() -> None:
    first = build_authority(
        activation_sha=ACTIVATION_SHA,
        model_evidence=_evidence(),
    )
    second = build_authority(
        activation_sha=ACTIVATION_SHA,
        model_evidence=_evidence(),
    )

    assert first == second
    assert first["productionHosting"] == "REG_RU_VPS_ONLY"
    assert first["newRecurringCostRub"] == 0
    model = first["model"]
    assert isinstance(model, dict)
    assert model["modelId"] == "tai-qwen3-8b-q4km"
    assert model["revision"] == f"artifact-{ARTIFACT_SHA256}"
    assert model["artifactSha256"] == ARTIFACT_SHA256
    assert model["permanentAdmissionStatus"] == "NOT_ATTESTED"
    assert model["restrictedOperational"] is True
    knowledge = first["knowledge"]
    assert isinstance(knowledge, dict)
    assert knowledge["sourceId"] == "tai-agro-os-master-spec-v4.0"
    assert knowledge["sourceReference"] == "TAI_Agro_OS_Master_Specification_v4.0.docx"
    assert "exact-main deployment" in str(knowledge["text"])
    assert "Qwen3-8B" in str(knowledge["text"])
    assert hashlib.sha256(str(knowledge["text"]).encode()).hexdigest() == knowledge[
        "documentChecksumSha256"
    ]

    without_digest = dict(first)
    authority_digest = without_digest.pop("authoritySha256")
    expected = hashlib.sha256(
        json.dumps(
            without_digest,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    ).hexdigest()
    assert authority_digest == expected


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("modelIdentity", "other-model"),
        ("artifactPath", "relative/model.gguf"),
        ("artifactSha256", "bad"),
        ("artifactSizeBytes", 0),
        ("maximumContextTokens", 256),
    ],
)
def test_bootstrap_authority_rejects_unverified_model_evidence(
    field: str,
    value: object,
) -> None:
    evidence = _evidence()
    evidence[field] = value
    with pytest.raises(ProductionBootstrapAuthorityError):
        build_authority(
            activation_sha=ACTIVATION_SHA,
            model_evidence=evidence,
        )


def test_bootstrap_authority_rejects_non_exact_activation_sha() -> None:
    with pytest.raises(ProductionBootstrapAuthorityError):
        build_authority(
            activation_sha="bad",
            model_evidence=_evidence(),
        )
