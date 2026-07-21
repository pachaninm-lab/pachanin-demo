from __future__ import annotations

import copy
import hashlib
import hmac
import json
from datetime import timedelta
from pathlib import Path

import pytest
from quality_scoring_fixtures import (
    NOW,
    _annotation_signature,
    _fixture,
    _provider_receipt,
    _rewrite_manifest,
    _signed,
    _verify,
)

from tai.quality_scoring_contract import (
    QualityScoringError,
    canonical_sha256,
    load_json,
    write_json,
)


def _canonical_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def _resign_assertion(fixture: dict[str, object], index: int = 0) -> None:
    manifest = fixture["manifest"]
    assert isinstance(manifest, dict)
    assertions = manifest["identity_assertions"]
    assert isinstance(assertions, list)
    assertion = copy.deepcopy(assertions[index])
    assert isinstance(assertion, dict)
    assertion.pop("signature", None)
    secret_path = fixture["identity_secret_path"]
    assert isinstance(secret_path, Path)
    assertion["signature"] = hmac.new(
        secret_path.read_bytes(),
        _canonical_bytes(assertion),
        hashlib.sha256,
    ).hexdigest()
    assertions[index] = assertion
    _rewrite_manifest(fixture)


def _resign_annotation(fixture: dict[str, object], index: int = 0) -> None:
    manifest = fixture["manifest"]
    assert isinstance(manifest, dict)
    annotations = manifest["annotations"]
    assert isinstance(annotations, list)
    row = copy.deepcopy(annotations[index])
    assert isinstance(row, dict)
    row.pop("annotation_sha256", None)
    row.pop("annotation_signature", None)
    secret_path = fixture["identity_secret_path"]
    assert isinstance(secret_path, Path)
    row["annotation_signature"] = _annotation_signature(
        secret_path.read_bytes(), row
    )
    annotations[index] = _signed(row, "annotation_sha256")
    _rewrite_manifest(fixture)


def _resign_provider_receipt(fixture: dict[str, object]) -> None:
    receipt = fixture["provider_receipt"]
    assert isinstance(receipt, dict)
    value = copy.deepcopy(receipt)
    value.pop("signature", None)
    secret_path = fixture["provider_secret_path"]
    receipt_path = fixture["provider_receipt_path"]
    assert isinstance(secret_path, Path)
    assert isinstance(receipt_path, Path)
    value["signature"] = hmac.new(
        secret_path.read_bytes(),
        _canonical_bytes(value),
        hashlib.sha256,
    ).hexdigest()
    fixture["provider_receipt"] = value
    write_json(receipt_path, value)


def test_fabricated_reviewer_signature_is_rejected(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    fixture["manifest"]["identity_assertions"][0]["signature"] = "f" * 64
    _rewrite_manifest(fixture)
    with pytest.raises(QualityScoringError, match="signature is invalid"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())


def test_annotation_content_requires_reviewer_signature(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    row = fixture["manifest"]["annotations"][0]
    row["decision"] = "FAIL"
    row.pop("annotation_sha256")
    row["annotation_sha256"] = canonical_sha256(row)
    _rewrite_manifest(fixture)
    with pytest.raises(QualityScoringError, match="annotation reviewer signature is invalid"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())


def test_submitter_declared_reviewer_identity_is_not_authority(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    fixture["manifest"]["annotations"][0]["scorer_id"] = "forged.reviewer"
    _resign_annotation(fixture)
    with pytest.raises(QualityScoringError, match="id is not server authenticated"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())


def test_mfa_absence_staleness_and_expiry_are_rejected(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path / "absent")
    fixture["manifest"]["identity_assertions"][0]["mfa_verified"] = False
    _resign_assertion(fixture)
    with pytest.raises(QualityScoringError, match="not MFA verified"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())

    fixture = _fixture(tmp_path / "stale")
    assertion = fixture["manifest"]["identity_assertions"][0]
    assertion["issued_at"] = (NOW - timedelta(hours=14)).isoformat()
    assertion["mfa_verified_at"] = (NOW - timedelta(hours=13)).isoformat()
    assertion["expires_at"] = (NOW + timedelta(hours=1)).isoformat()
    _resign_assertion(fixture)
    with pytest.raises(QualityScoringError, match="MFA verification is stale"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())

    fixture = _fixture(tmp_path / "expired")
    assertion = fixture["manifest"]["identity_assertions"][0]
    assertion["issued_at"] = (NOW - timedelta(hours=2)).isoformat()
    assertion["mfa_verified_at"] = (NOW - timedelta(hours=1, minutes=30)).isoformat()
    assertion["expires_at"] = (NOW - timedelta(minutes=1)).isoformat()
    _resign_assertion(fixture)
    with pytest.raises(QualityScoringError, match="assertion is expired"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())


def test_operator_trust_anchors_are_required(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path / "identity")
    fixture["trusted_secret_sha256"] = "f" * 64
    with pytest.raises(QualityScoringError, match="trust anchor mismatch"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())

    fixture = _fixture(tmp_path / "provider")
    fixture["trusted_provider_secret_sha256"] = "f" * 64
    with pytest.raises(QualityScoringError, match="provider inventory secret trust anchor"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())


def test_provider_inventory_signature_and_expiry_are_rejected(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path / "signature")
    fixture["provider_receipt"]["signature"] = "f" * 64
    write_json(fixture["provider_receipt_path"], fixture["provider_receipt"])
    with pytest.raises(QualityScoringError, match="receipt signature is invalid"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())

    fixture = _fixture(tmp_path / "expired")
    fixture["provider_receipt"]["expires_at"] = (NOW + timedelta(minutes=2)).isoformat()
    _resign_provider_receipt(fixture)
    with pytest.raises(QualityScoringError, match="receipt is expired"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())


def test_manifest_scored_at_must_equal_authenticated_completion(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    fixture["manifest"]["scored_at"] = (NOW - timedelta(days=200)).isoformat()
    _rewrite_manifest(fixture)
    with pytest.raises(QualityScoringError, match="annotation completion"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())


def test_external_manifest_and_original_restore_tamper_are_rejected(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path / "manifest")
    manifest_path = fixture["reviewer_manifest_path"]
    assert isinstance(manifest_path, Path)
    manifest_path.write_bytes(manifest_path.read_bytes() + b" ")
    with pytest.raises(QualityScoringError, match="manifest size mismatch"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())

    fixture = _fixture(tmp_path / "original")
    evidence_manifest = load_json(fixture["reviewer_manifest_path"])
    relative = evidence_manifest["files"][0]["relative_path"]
    original_root = fixture["reviewer_original_root"]
    assert isinstance(original_root, Path)
    (original_root / relative).write_bytes(b"tampered-original\n")
    with pytest.raises(QualityScoringError, match="payload mismatch|size mismatch"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())

    fixture = _fixture(tmp_path / "restored")
    evidence_manifest = load_json(fixture["reviewer_manifest_path"])
    relative = evidence_manifest["files"][0]["relative_path"]
    restored_root = fixture["reviewer_restored_root"]
    assert isinstance(restored_root, Path)
    (restored_root / relative).write_bytes(b"tampered-restored\n")
    with pytest.raises(QualityScoringError, match="payload mismatch|size mismatch"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())


def test_submitter_object_identity_cannot_override_trusted_inventory(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path)
    manifest_path = fixture["reviewer_manifest_path"]
    value = load_json(manifest_path)
    value["files"][0]["object_version_id"] = "forged-version"
    fixture["manifest"]["annotations"][0]["evidence_object_version_id"] = (
        "forged-version"
    )
    _resign_annotation(fixture)
    value.pop("manifest_sha256")
    value = _signed(value, "manifest_sha256")
    write_json(manifest_path, value)
    raw = manifest_path.read_bytes()
    for root_name in ("reviewer_original_root", "reviewer_restored_root"):
        root = fixture[root_name]
        assert isinstance(root, Path)
        (root / "reviewer-evidence/manifest.json").write_bytes(raw)
    storage = fixture["manifest"]["storage"]
    storage["evidence_manifest_size_bytes"] = len(raw)
    storage["evidence_manifest_file_sha256"] = hashlib.sha256(raw).hexdigest()
    storage["evidence_manifest_sha256"] = value["manifest_sha256"]
    _rewrite_manifest(fixture)
    with pytest.raises(QualityScoringError, match="provider inventory manifest sha256 mismatch"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())


def test_external_retention_and_roots_are_rejected(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path / "retention")
    fixture["manifest"]["storage"]["retention_until"] = (
        NOW + timedelta(days=10)
    ).isoformat()
    _rewrite_manifest(fixture)
    with pytest.raises(QualityScoringError, match="retention deadline is insufficient"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())

    fixture = _fixture(tmp_path / "same-root")
    fixture["reviewer_restored_root"] = fixture["reviewer_original_root"]
    with pytest.raises(QualityScoringError, match="restore roots are not independent"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())


def test_external_manifest_record_digest_cannot_be_declared_only(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    path = fixture["reviewer_manifest_path"]
    assert isinstance(path, Path)
    value = load_json(path)
    value["files"][0]["sha256"] = "f" * 64
    fixture["manifest"]["annotations"][0]["evidence_sha256"] = "f" * 64
    _resign_annotation(fixture)
    value.pop("manifest_sha256")
    value = _signed(value, "manifest_sha256")
    write_json(path, value)
    raw = path.read_bytes()
    for root_name in ("reviewer_original_root", "reviewer_restored_root"):
        root = fixture[root_name]
        assert isinstance(root, Path)
        (root / "reviewer-evidence/manifest.json").write_bytes(raw)
    storage = fixture["manifest"]["storage"]
    storage["evidence_manifest_size_bytes"] = len(raw)
    storage["evidence_manifest_file_sha256"] = hashlib.sha256(raw).hexdigest()
    storage["evidence_manifest_sha256"] = value["manifest_sha256"]
    secret_path = fixture["provider_secret_path"]
    assert isinstance(secret_path, Path)
    fixture["provider_receipt"] = _provider_receipt(
        fixture["provider_receipt_path"],
        secret_path.read_bytes(),
        storage,
        value,
    )
    _rewrite_manifest(fixture)
    with pytest.raises(QualityScoringError, match="file digest mismatch"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())
