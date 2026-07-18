from datetime import UTC, datetime

import pytest

from tai.evaluation import EvaluationCategory, EvaluationSeverity
from tai.release_evaluation_suite import (
    EvaluationFixture,
    ReleaseEvaluationManifest,
    build_release_evaluation_manifest,
)

NOW = datetime(2026, 7, 18, 19, 0, tzinfo=UTC)


def test_release_manifest_meets_default_release_policy_shape() -> None:
    manifest = build_release_evaluation_manifest(
        tenant_id="tenant-under-test",
        created_at=NOW,
    )

    assert len(manifest.suite.cases) >= 20
    assert {case.category for case in manifest.suite.cases} == set(EvaluationCategory)
    assert sum(
        case.severity is EvaluationSeverity.CRITICAL for case in manifest.suite.cases
    ) >= 10
    assert len(manifest.fixtures) == len(manifest.suite.cases)
    assert len(manifest.manifest_sha256) == 64
    assert all(len(fixture.input_sha256) == 64 for fixture in manifest.fixtures)
    empty_fixture = next(
        fixture for fixture in manifest.fixtures if fixture.case_id == "adversarial.empty"
    )
    assert empty_fixture.prompt == "<EMPTY_INPUT>"


def test_manifest_is_deterministic_and_binds_fixture_inputs() -> None:
    first = build_release_evaluation_manifest(
        tenant_id="tenant-under-test",
        created_at=NOW,
    )
    second = build_release_evaluation_manifest(
        tenant_id="tenant-under-test",
        created_at=NOW,
    )

    assert first == second
    changed_fixture = EvaluationFixture(
        case_id=first.fixtures[0].case_id,
        prompt="Изменённый вход",
        input_sha256="00ed83554f0d0d10d3a33e2a471c1a4713da71db0f111d1f5c348670b22f66f5",
    )
    with pytest.raises(ValueError, match="digest"):
        EvaluationFixture(
            case_id="invalid",
            prompt="input",
            input_sha256="0" * 64,
        )
    with pytest.raises(ValueError, match="fixtures"):
        ReleaseEvaluationManifest(
            suite=first.suite,
            fixtures=(changed_fixture, *first.fixtures[1:]),
            manifest_sha256=first.manifest_sha256,
        )


def test_manifest_requires_tenant_and_timezone_aware_creation() -> None:
    with pytest.raises(ValueError, match="tenant_id"):
        build_release_evaluation_manifest(tenant_id=" ", created_at=NOW)
    with pytest.raises(ValueError, match="timezone-aware"):
        build_release_evaluation_manifest(
            tenant_id="tenant-under-test",
            created_at=datetime(2026, 7, 18, 19, 0),
        )
