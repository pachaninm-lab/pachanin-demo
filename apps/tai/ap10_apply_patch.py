from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OPERATIONS = ROOT / "apps/tai/tai/operations.py"
TEST_OPERATIONS = ROOT / "apps/tai/tests/test_operations.py"
MIGRATION = ROOT / "apps/tai/tai/migrations/0010_operational_authority.sql"
WORKFLOW = ROOT / ".github/workflows/tai-ap10-commit-patch.yml"


def patch_operations() -> None:
    text = OPERATIONS.read_text()
    start = text.index("@dataclass(frozen=True, slots=True)\nclass SLOAssessment:")
    end = text.index("\ndef assess_slo(\n", start)
    block = '''@dataclass(frozen=True, slots=True)
class SLOAssessment:
    slo_id: str
    indicator: OperationalIndicator
    exact_head_sha: str
    status: SLOAssessmentStatus
    value: float | None
    target: float
    sample_count: int
    reason: str | None
    observation_id: str | None
    assessed_at: datetime
    assessment_sha256: str

    def __post_init__(self) -> None:
        _portable(self.slo_id, "slo_id")
        _digest(self.exact_head_sha, "exact_head_sha")
        if self.value is not None:
            _finite(self.value, "assessment value")
        _finite(self.target, "assessment target")
        if self.sample_count < 0:
            raise ValueError("assessment sample_count must not be negative")
        if self.reason is not None and not self.reason.strip():
            raise ValueError("assessment reason must be null or non-blank")
        if self.observation_id is not None:
            _portable(self.observation_id, "observation_id")
        _aware(self.assessed_at, "assessed_at")
        _digest(self.assessment_sha256, "assessment_sha256")
        expected = slo_assessment_sha256(
            slo_id=self.slo_id,
            indicator=self.indicator,
            exact_head_sha=self.exact_head_sha,
            status=self.status,
            value=self.value,
            target=self.target,
            sample_count=self.sample_count,
            reason=self.reason,
            observation_id=self.observation_id,
            assessed_at=self.assessed_at,
        )
        if self.assessment_sha256 != expected:
            raise ValueError("SLO assessment digest does not match assessment fields")


def slo_assessment_sha256(
    *,
    slo_id: str,
    indicator: OperationalIndicator,
    exact_head_sha: str,
    status: SLOAssessmentStatus,
    value: float | None,
    target: float,
    sample_count: int,
    reason: str | None,
    observation_id: str | None,
    assessed_at: datetime,
) -> str:
    return _sha256_json(
        {
            "assessed_at": assessed_at.isoformat(),
            "exact_head_sha": exact_head_sha,
            "indicator": indicator.value,
            "observation_id": observation_id,
            "reason": reason,
            "sample_count": sample_count,
            "slo_id": slo_id,
            "status": status.value,
            "target": target,
            "value": value,
        }
    )

'''
    text = text[:start] + block + text[end + 1 :]

    assess_start = text.index("def assess_slo(\n")
    payload_start = text.index("    payload = {\n", assess_start)
    payload_end = text.index("\n\ndef _threshold_status(", payload_start)
    replacement = '''    assessment_sha256 = slo_assessment_sha256(
        slo_id=definition.slo_id,
        indicator=definition.indicator,
        exact_head_sha=exact_head_sha,
        status=status,
        value=value,
        target=definition.target,
        sample_count=sample_count,
        reason=reason,
        observation_id=observation_id,
        assessed_at=assessed_at,
    )
    return SLOAssessment(
        slo_id=definition.slo_id,
        indicator=definition.indicator,
        exact_head_sha=exact_head_sha,
        status=status,
        value=value,
        target=definition.target,
        sample_count=sample_count,
        reason=reason,
        observation_id=observation_id,
        assessed_at=assessed_at,
        assessment_sha256=assessment_sha256,
    )
'''
    text = text[:payload_start] + replacement + text[payload_end:]

    marker = "        status_counts = {\n"
    if text.count(marker) != 1:
        raise RuntimeError(f"status marker count={text.count(marker)}")
    text = text.replace(
        marker,
        '''        for item in assessments_by_indicator.values():
            if item.exact_head_sha != exact_head_sha:
                reasons.append("SLO_EXACT_HEAD_MISMATCH")
            if item.assessed_at > decided_at:
                reasons.append("SLO_ASSESSMENT_FROM_FUTURE")
        status_counts = {
''',
        1,
    )

    lines = text.splitlines()
    first_assert = lines.index("    assert previous is not None")
    if lines[first_assert + 1] != "    assert status is not None":
        raise RuntimeError("incident replay assertions are not adjacent")
    lines[first_assert : first_assert + 2] = [
        "    if previous is None or status is None:",
        '        raise RuntimeError("incident replay produced incomplete state")',
    ]
    text = "\n".join(lines) + "\n"
    ast.parse(text, filename=str(OPERATIONS))
    OPERATIONS.write_text(text)


def patch_tests() -> None:
    lines = TEST_OPERATIONS.read_text().splitlines()
    if "    slo_assessment_sha256," not in lines:
        index = lines.index("    replay_incident,")
        lines.insert(index + 1, "    slo_assessment_sha256,")

    start = next(index for index, line in enumerate(lines) if line == "def _assessment(")
    end = next(
        index
        for index, line in enumerate(lines[start + 1 :], start + 1)
        if line.startswith("def _evidence(")
    )
    helper = '''def _assessment(
    indicator: OperationalIndicator,
    status: SLOAssessmentStatus = SLOAssessmentStatus.PASS,
) -> SLOAssessment:
    slo_id = f"tai.{indicator.value.casefold()}"
    value = 1.0 if status is not SLOAssessmentStatus.UNKNOWN else None
    reason = None if status is not SLOAssessmentStatus.UNKNOWN else "MISSING_OBSERVATION"
    observation_id = (
        f"obs.{indicator.value.casefold()}"
        if status is not SLOAssessmentStatus.UNKNOWN
        else None
    )
    digest = slo_assessment_sha256(
        slo_id=slo_id,
        indicator=indicator,
        exact_head_sha=HEAD,
        status=status,
        value=value,
        target=1.0,
        sample_count=1000,
        reason=reason,
        observation_id=observation_id,
        assessed_at=NOW,
    )
    return SLOAssessment(
        slo_id=slo_id,
        indicator=indicator,
        exact_head_sha=HEAD,
        status=status,
        value=value,
        target=1.0,
        sample_count=1000,
        reason=reason,
        observation_id=observation_id,
        assessed_at=NOW,
        assessment_sha256=digest,
    )

'''.splitlines()
    lines[start:end] = helper

    evidence_start = next(
        index for index, line in enumerate(lines) if line.startswith("def _evidence(")
    )
    digest_index = next(
        index
        for index, line in enumerate(lines[evidence_start:], evidence_start)
        if "artifact_sha256=" in line
    )
    lines[digest_index] = '        artifact_sha256="c" * 64,'
    text = "\n".join(lines) + "\n"
    ast.parse(text, filename=str(TEST_OPERATIONS))
    TEST_OPERATIONS.write_text(text)


def patch_migration() -> None:
    text = MIGRATION.read_text()
    old = "    value DOUBLE PRECISION NOT NULL CHECK (isfinite(value)),\n"
    new = '''    value DOUBLE PRECISION NOT NULL CHECK (
        value NOT IN (
            'NaN'::DOUBLE PRECISION,
            'Infinity'::DOUBLE PRECISION,
            '-Infinity'::DOUBLE PRECISION
        )
    ),
'''
    if text.count(old) != 1:
        raise RuntimeError(f"finite constraint marker count={text.count(old)}")
    MIGRATION.write_text(text.replace(old, new, 1))


def main() -> None:
    patch_operations()
    patch_tests()
    patch_migration()
    Path(__file__).unlink()
    WORKFLOW.unlink()


if __name__ == "__main__":
    main()
