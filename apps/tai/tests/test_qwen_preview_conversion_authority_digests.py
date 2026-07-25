"""Two different digests describe the executed conversion authority.

The conversion workflow copies the committed authority into its control package
and then appends an `execution` block, so the file that actually ran is by
construction not byte-identical to its source. That makes two digests necessary:

* the raw SHA-256 of the executed bytes, which pins what ran on the model host;
* the canonical-JSON digest of the committed source, recorded inside that file as
  `execution.committed_authority_sha256`, which ties the run to reviewed input.

The preview previously carried the committed digest in the field the remote
compares against raw bytes, so the check could never pass — a category error
between two kinds of digest, not a wrong constant. These tests pin that the two
stay distinct, that neither can stand in for the other, and that the committed
digest still matches the authority in this repository.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import pytest

from tai import qwen_preview_runtime as runtime

TAI_ROOT = Path(__file__).parents[1]
AUTHORITY = TAI_ROOT / "model-artifacts" / "qwen-preview-runtime-authority.v1.json"
REMOTE = TAI_ROOT / "model-artifacts" / "qwen-preview-runtime-remote.v1.sh"
SOURCE_CONVERSION_AUTHORITY = (
    TAI_ROOT / "model-artifacts" / "model-conversion-authority.v1.json"
)

EXECUTED_DIGEST = "4c7d8222f6bc2b7b81f29aaf4c575b611f611981d34a6a88772be4371350139b"
COMMITTED_DIGEST = "e7531a0d19fbdb92d14fa84d8bb3fd5a4a012ee61e3bf7cc632513bd435388f4"


def _authority() -> dict[str, Any]:
    return json.loads(AUTHORITY.read_text(encoding="utf-8"))


def _resign(document: dict[str, Any]) -> dict[str, Any]:
    """Re-sign so a rejection proves the contract, not a stale self-digest."""
    unsigned = dict(document)
    unsigned.pop("authority_sha256", None)
    document["authority_sha256"] = runtime.canonical_sha256(unsigned)
    return document


def _write(path: Path, document: dict[str, Any]) -> Path:
    path.write_text(
        json.dumps(document, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return path


class TestTheTwoDigestsAreDistinct:
    def test_committed_digest_is_the_canonical_digest_of_the_repository_source(
        self,
    ) -> None:
        """Ties the constant to reviewed input rather than to a copied string."""
        source = json.loads(SOURCE_CONVERSION_AUTHORITY.read_text(encoding="utf-8"))
        assert runtime.canonical_sha256(source) == COMMITTED_DIGEST

    def test_executed_digest_is_not_the_canonical_digest_of_the_source(self) -> None:
        source = json.loads(SOURCE_CONVERSION_AUTHORITY.read_text(encoding="utf-8"))
        assert runtime.canonical_sha256(source) != EXECUTED_DIGEST

    def test_executed_digest_is_not_the_raw_digest_of_the_source(self) -> None:
        raw = hashlib.sha256(SOURCE_CONVERSION_AUTHORITY.read_bytes()).hexdigest()
        assert raw != EXECUTED_DIGEST
        assert raw != COMMITTED_DIGEST

    def test_authority_carries_both_digests_and_they_differ(self) -> None:
        conversion = _authority()["conversion_input"]
        assert conversion["conversion_authority_sha256"] == EXECUTED_DIGEST
        assert conversion["conversion_committed_authority_sha256"] == COMMITTED_DIGEST
        assert (
            conversion["conversion_authority_sha256"]
            != conversion["conversion_committed_authority_sha256"]
        )


class TestNeitherDigestCanStandInForTheOther:
    def test_committed_digest_cannot_occupy_the_executed_field(
        self, tmp_path: Path
    ) -> None:
        """This is the exact regression: the field the remote hashes bytes against."""
        document = _authority()
        document["conversion_input"]["conversion_authority_sha256"] = COMMITTED_DIGEST
        path = _write(tmp_path / "authority.json", _resign(document))
        with pytest.raises(runtime.PreviewRuntimeError, match="conversion input"):
            runtime.load_authority(path)

    def test_executed_digest_cannot_occupy_the_committed_field(
        self, tmp_path: Path
    ) -> None:
        document = _authority()
        document["conversion_input"]["conversion_committed_authority_sha256"] = (
            EXECUTED_DIGEST
        )
        path = _write(tmp_path / "authority.json", _resign(document))
        with pytest.raises(runtime.PreviewRuntimeError, match="conversion input"):
            runtime.load_authority(path)

    def test_swapping_the_two_digests_is_rejected(self, tmp_path: Path) -> None:
        document = _authority()
        conversion = document["conversion_input"]
        conversion["conversion_authority_sha256"] = COMMITTED_DIGEST
        conversion["conversion_committed_authority_sha256"] = EXECUTED_DIGEST
        path = _write(tmp_path / "authority.json", _resign(document))
        with pytest.raises(runtime.PreviewRuntimeError, match="conversion input"):
            runtime.load_authority(path)

    def test_dropping_the_committed_field_is_rejected(self, tmp_path: Path) -> None:
        document = _authority()
        del document["conversion_input"]["conversion_committed_authority_sha256"]
        path = _write(tmp_path / "authority.json", _resign(document))
        with pytest.raises(runtime.PreviewRuntimeError, match="conversion_input keys"):
            runtime.load_authority(path)


class TestConversionBindingCannotDrift:
    @pytest.mark.parametrize(
        ("field", "value"),
        [
            ("exact_main_sha", "0" * 40),
            ("workflow_run_id", 29810648431),
            ("workflow_run_attempt", 2),
            ("required_root_state", "PARTIAL"),
            ("required_step_status", "PENDING"),
            (
                "model_sha256",
                "0000000000000000000000000000000000000000000000000000000000000000",
            ),
            ("model_size_bytes", 5027784031),
            (
                "report_sha256",
                "1111111111111111111111111111111111111111111111111111111111111111",
            ),
        ],
    )
    def test_altered_binding_is_rejected(
        self, tmp_path: Path, field: str, value: object
    ) -> None:
        document = _authority()
        document["conversion_input"][field] = value
        path = _write(tmp_path / "authority.json", _resign(document))
        with pytest.raises(runtime.PreviewRuntimeError, match="conversion input"):
            runtime.load_authority(path)

    def test_one_changed_byte_breaks_the_authority_self_digest(
        self, tmp_path: Path
    ) -> None:
        """Not re-signed on purpose: the self-digest must catch a lone edit."""
        document = _authority()
        document["conversion_input"]["conversion_authority_sha256"] = (
            EXECUTED_DIGEST[:-1] + ("a" if EXECUTED_DIGEST[-1] != "a" else "b")
        )
        path = _write(tmp_path / "authority.json", document)
        with pytest.raises(runtime.PreviewRuntimeError, match="authority"):
            runtime.load_authority(path)

    def test_unmodified_authority_is_accepted(self) -> None:
        authority = runtime.load_authority(AUTHORITY)
        conversion = authority["conversion_input"]
        assert conversion["exact_main_sha"] == (
            "8bd494dc4954baaf699cffa243951392ff451ebb"
        )
        assert conversion["workflow_run_id"] == 29810648430
        assert conversion["workflow_run_attempt"] == 1
        assert conversion["required_root_state"] == "COMPLETE"
        assert conversion["required_step_status"] == "COMPLETE"
        assert conversion["model_size_bytes"] == 5027784032


class TestRemoteVerifierChecksBothIndependently:
    def test_remote_hashes_the_bytes_and_reads_the_recorded_field(self) -> None:
        remote = REMOTE.read_text(encoding="utf-8")
        assert "hashlib.sha256(conversion_authority_bytes).hexdigest()" in remote
        assert 'conversion["conversion_authority_sha256"]' in remote
        assert 'conversion_execution.get("committed_authority_sha256")' in remote
        assert 'conversion["conversion_committed_authority_sha256"]' in remote

    def test_remote_still_binds_the_run_identity_inside_the_executed_file(self) -> None:
        remote = REMOTE.read_text(encoding="utf-8")
        for message in (
            "conversion authority digest mismatch",
            "conversion committed authority digest mismatch",
            "conversion authority exact-main mismatch",
            "conversion authority workflow run mismatch",
            "conversion authority workflow attempt mismatch",
        ):
            assert message in remote

    def test_remote_does_not_replace_the_raw_check_with_the_field_check(self) -> None:
        """Reading the recorded field is an addition, never a substitution."""
        remote = REMOTE.read_text(encoding="utf-8")
        raw_check = remote.index("hashlib.sha256(conversion_authority_bytes)")
        field_check = remote.index('conversion_execution.get("committed_authority_sha256")')
        assert raw_check < field_check
