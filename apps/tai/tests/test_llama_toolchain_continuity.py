from __future__ import annotations

import json
from pathlib import Path

import pytest

from tai.llama_toolchain_continuity import (
    ACCEPTANCE_SCHEMA,
    CONTINUITY_SCHEMA,
    ContinuityStatus,
    compare_authority,
    load_recorded_authority,
    verify_toolchain_continuity,
)
from tai.llama_toolchain_continuity_cli import main
from tai.llama_toolchain_contract import load_llama_toolchain_authority

ARTIFACTS = Path(__file__).parents[1] / "model-artifacts"
AUTHORITY = ARTIFACTS / "llama-cpp-toolchain-authority.v1.json"
ACCEPTANCE = ARTIFACTS / "llama-cpp-build-acceptance.v1.json"


def _acceptance_payload() -> dict:
    return json.loads(ACCEPTANCE.read_text(encoding="utf-8"))


def _write(path: Path, payload: dict) -> Path:
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return path


class TestCommittedEvidence:
    """The repository's own record must hold, or the pin has silently moved."""

    def test_the_recorded_pin_still_matches_the_declared_authority(self) -> None:
        report = verify_toolchain_continuity(
            authority_path=AUTHORITY, acceptance_path=ACCEPTANCE
        )

        assert report.status is ContinuityStatus.CONTINUOUS
        assert report.reasons == ()
        assert report.recorded.release == "b9637"
        assert report.recorded.authority_sha256 == report.declared_authority_sha256

    def test_the_digest_is_recomputed_rather_than_taken_from_either_document(self) -> None:
        """Trusting the recorded string would let an edited pin keep a stale digest."""
        declared = load_llama_toolchain_authority(AUTHORITY)
        recorded, _, _ = load_recorded_authority(ACCEPTANCE)

        assert declared.authority_sha256 == recorded.authority_sha256

    def test_the_payload_never_raises_maturity(self) -> None:
        payload = verify_toolchain_continuity(
            authority_path=AUTHORITY, acceptance_path=ACCEPTANCE
        ).payload()

        assert payload["schema_version"] == CONTINUITY_SCHEMA
        assert payload["status"] == "CONTINUOUS"
        assert payload["operational_status"] == "NOT_ATTESTED"
        assert payload["acceptance_status"] == "VERIFIED_RESTORED"
        assert "ADMITTED" not in json.dumps(payload)


class TestBrokenContinuity:
    """Each field of the pin is load-bearing, so each must be able to fail on its own."""

    @pytest.mark.parametrize(
        ("field", "value", "reason"),
        [
            ("release", "b9999", "RELEASE_MISMATCH"),
            ("commit", "0" * 40, "COMMIT_MISMATCH"),
            ("profile_id", "some-other-profile", "BUILD_PROFILE_MISMATCH"),
            ("toolchain_name", "someone-else/llama.cpp", "TOOLCHAIN_NAME_MISMATCH"),
            ("repository_uri", "https://example.invalid/llama.cpp", "REPOSITORY_URI_MISMATCH"),
            ("authority_sha256", "f" * 64, "AUTHORITY_SHA256_MISMATCH"),
        ],
    )
    def test_a_moved_field_is_named(
        self, tmp_path: Path, field: str, value: str, reason: str
    ) -> None:
        payload = _acceptance_payload()
        payload["authority"][field] = value
        acceptance = _write(tmp_path / "acceptance.json", payload)

        report = verify_toolchain_continuity(
            authority_path=AUTHORITY, acceptance_path=acceptance
        )

        assert report.status is ContinuityStatus.BROKEN
        assert reason in report.reasons

    def test_every_moved_field_is_reported_not_just_the_first(self, tmp_path: Path) -> None:
        payload = _acceptance_payload()
        payload["authority"]["release"] = "b9999"
        payload["authority"]["commit"] = "0" * 40
        acceptance = _write(tmp_path / "acceptance.json", payload)

        report = verify_toolchain_continuity(
            authority_path=AUTHORITY, acceptance_path=acceptance
        )

        assert set(report.reasons) >= {"RELEASE_MISMATCH", "COMMIT_MISMATCH"}

    def test_comparison_is_clean_only_when_nothing_moved(self) -> None:
        declared = load_llama_toolchain_authority(AUTHORITY)
        recorded, _, _ = load_recorded_authority(ACCEPTANCE)

        assert compare_authority(declared, recorded) == ()


class TestStrictParsing:
    """An unexpected record shape is a refusal. Defaults would invent continuity."""

    def test_a_non_object_record_is_refused(self, tmp_path: Path) -> None:
        path = tmp_path / "acceptance.json"
        path.write_text("[]", encoding="utf-8")

        with pytest.raises(ValueError, match="must be a JSON object"):
            load_recorded_authority(path)

    def test_a_foreign_schema_is_refused(self, tmp_path: Path) -> None:
        payload = _acceptance_payload()
        payload["schema_version"] = "tai.something-else.v1"

        with pytest.raises(ValueError, match=ACCEPTANCE_SCHEMA):
            load_recorded_authority(_write(tmp_path / "a.json", payload))

    def test_a_missing_authority_reference_is_refused(self, tmp_path: Path) -> None:
        payload = _acceptance_payload()
        del payload["authority"]

        with pytest.raises(ValueError, match="authority reference"):
            load_recorded_authority(_write(tmp_path / "a.json", payload))

    def test_extra_or_missing_authority_keys_are_refused(self, tmp_path: Path) -> None:
        payload = _acceptance_payload()
        payload["authority"]["unexpected"] = "value"

        with pytest.raises(ValueError, match="keys must be exact"):
            load_recorded_authority(_write(tmp_path / "a.json", payload))

    def test_a_blank_authority_field_is_refused(self, tmp_path: Path) -> None:
        payload = _acceptance_payload()
        payload["authority"]["release"] = "   "

        with pytest.raises(ValueError, match="must be non-empty text"):
            load_recorded_authority(_write(tmp_path / "a.json", payload))

    def test_a_missing_status_is_refused(self, tmp_path: Path) -> None:
        payload = _acceptance_payload()
        payload["status"] = ""

        with pytest.raises(ValueError, match="must carry a status"):
            load_recorded_authority(_write(tmp_path / "a.json", payload))

    def test_a_record_without_its_build_commit_is_refused(self, tmp_path: Path) -> None:
        payload = _acceptance_payload()
        del payload["build_run"]["repository_sha"]

        with pytest.raises(ValueError, match="repository commit"):
            load_recorded_authority(_write(tmp_path / "a.json", payload))

    def test_a_missing_build_run_is_refused(self, tmp_path: Path) -> None:
        payload = _acceptance_payload()
        del payload["build_run"]

        with pytest.raises(ValueError, match="must carry a build run"):
            load_recorded_authority(_write(tmp_path / "a.json", payload))


class TestCli:
    def test_continuity_exits_zero_and_writes_evidence(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        output = tmp_path / "evidence" / "continuity.json"

        code = main([str(AUTHORITY), str(ACCEPTANCE), "--output", str(output)])

        assert code == 0
        written = json.loads(output.read_text(encoding="utf-8"))
        assert written["status"] == "CONTINUOUS"
        assert written["operational_status"] == "NOT_ATTESTED"
        assert json.loads(capsys.readouterr().out)["status"] == "CONTINUOUS"

    def test_a_broken_pin_exits_non_zero(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """A drifted pin must fail the job, not merely be described in a report."""
        payload = _acceptance_payload()
        payload["authority"]["release"] = "b9999"
        acceptance = _write(tmp_path / "acceptance.json", payload)

        code = main([str(AUTHORITY), str(acceptance)])

        assert code == 1
        assert "RELEASE_MISMATCH" in capsys.readouterr().out

    def test_output_is_optional(self, capsys: pytest.CaptureFixture[str]) -> None:
        assert main([str(AUTHORITY), str(ACCEPTANCE)]) == 0
        assert capsys.readouterr().out.strip().startswith("{")
