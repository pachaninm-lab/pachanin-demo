from __future__ import annotations

from collections.abc import Mapping, Sequence
from contextlib import AbstractContextManager
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from tai.postgres_release_acceptance import PostgreSQLReleaseAttestationRepository
from tai.release_acceptance import (
    ApplicationReleaseAttestation,
    ProductionOperationalStatus,
    ProductionReleaseAttestation,
    application_attestation_sha256,
    production_attestation_sha256,
)

NOW = datetime(2026, 7, 18, 23, 30, tzinfo=UTC)
HEAD = "a" * 64


class _Cursor(AbstractContextManager["_Cursor"]):
    def __init__(self, rows: list[Mapping[str, Any] | None], *, fail: bool = False) -> None:
        self.rows = rows
        self.fail = fail
        self.executions: list[tuple[str, tuple[Any, ...]]] = []

    def __enter__(self) -> _Cursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None:
        if self.fail:
            raise RuntimeError("database unavailable")
        self.executions.append((query, tuple(parameters)))

    def fetchone(self) -> Mapping[str, Any] | None:
        if not self.rows:
            raise AssertionError("unexpected fetchone call")
        return self.rows.pop(0)


class _Connection(AbstractContextManager["_Connection"]):
    def __init__(self, rows: list[Mapping[str, Any] | None], *, fail: bool = False) -> None:
        self.cursor_instance = _Cursor(rows, fail=fail)
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> _Cursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class _Factory:
    def __init__(self, rows: list[Mapping[str, Any] | None], *, fail: bool = False) -> None:
        self.connection = _Connection(rows, fail=fail)

    def __call__(self) -> _Connection:
        return self.connection


def _application() -> ApplicationReleaseAttestation:
    release_id = "b" * 64
    workflow_digests = ("c" * 64, "d" * 64)
    digest = application_attestation_sha256(
        release_id=release_id,
        repository="pachaninm-lab/pachanin-demo",
        exact_main_sha=HEAD,
        accepted=True,
        reasons=(),
        source_tree_sha256="e" * 64,
        migration_inventory_sha256="f" * 64,
        workflow_evidence_sha256s=workflow_digests,
        previous_attestation_sha256=None,
        created_at=NOW,
        production_operational_status=ProductionOperationalStatus.NOT_ATTESTED,
    )
    return ApplicationReleaseAttestation(
        release_id=release_id,
        repository="pachaninm-lab/pachanin-demo",
        exact_main_sha=HEAD,
        accepted=True,
        reasons=(),
        source_tree_sha256="e" * 64,
        migration_inventory_sha256="f" * 64,
        workflow_evidence_sha256s=workflow_digests,
        previous_attestation_sha256=None,
        created_at=NOW,
        production_operational_status=ProductionOperationalStatus.NOT_ATTESTED,
        attestation_sha256=digest,
    )


def _production(
    *,
    status: ProductionOperationalStatus = ProductionOperationalStatus.ACCEPTED,
    reasons: tuple[str, ...] = (),
    attested_at: datetime = NOW,
) -> ProductionReleaseAttestation:
    application = _application()
    digest = production_attestation_sha256(
        release_id=application.release_id,
        exact_main_sha=HEAD,
        application_attestation_sha256=application.attestation_sha256,
        evaluation_report_sha256="1" * 64,
        operational_decision_sha256="2" * 64,
        status=status,
        reasons=reasons,
        attested_at=attested_at,
    )
    return ProductionReleaseAttestation(
        release_id=application.release_id,
        exact_main_sha=HEAD,
        application_attestation_sha256=application.attestation_sha256,
        evaluation_report_sha256="1" * 64,
        operational_decision_sha256="2" * 64,
        status=status,
        reasons=reasons,
        attested_at=attested_at,
        attestation_sha256=digest,
    )


def test_application_attestation_is_persisted_idempotently() -> None:
    attestation = _application()
    factory = _Factory(
        [
            {
                "release_id": attestation.release_id,
                "attestation_sha256": attestation.attestation_sha256,
            }
        ]
    )

    PostgreSQLReleaseAttestationRepository(factory).record_application(attestation)

    query, parameters = factory.connection.cursor_instance.executions[0]
    assert "ON CONFLICT (attestation_sha256) DO UPDATE" in query
    assert "previous_attestation_sha256" in query
    assert parameters[0] == attestation.attestation_sha256
    assert parameters[1] == attestation.release_id
    assert parameters[3] == HEAD
    assert parameters[11] == "NOT_ATTESTED"
    assert factory.connection.committed is True
    assert factory.connection.rolled_back is False


def test_production_attestation_is_persisted_idempotently() -> None:
    attestation = _production()
    factory = _Factory(
        [
            {
                "release_id": attestation.release_id,
                "attestation_sha256": attestation.attestation_sha256,
            }
        ]
    )

    PostgreSQLReleaseAttestationRepository(factory).record_production(attestation)

    query, parameters = factory.connection.cursor_instance.executions[0]
    assert "tai_production_release_attestations" in query
    assert "ON CONFLICT (attestation_sha256) DO UPDATE" in query
    assert parameters[0] == attestation.attestation_sha256
    assert parameters[1] == attestation.release_id
    assert parameters[6] == "ACCEPTED"
    assert factory.connection.committed is True


def test_rejected_then_accepted_production_history_uses_distinct_digests() -> None:
    rejected = _production(
        status=ProductionOperationalStatus.REJECTED,
        reasons=("operational evidence incomplete",),
    )
    accepted = _production(attested_at=NOW + timedelta(minutes=30))
    assert rejected.release_id == accepted.release_id
    assert rejected.attestation_sha256 != accepted.attestation_sha256

    factory = _Factory(
        [
            {
                "release_id": rejected.release_id,
                "attestation_sha256": rejected.attestation_sha256,
            },
            {
                "release_id": accepted.release_id,
                "attestation_sha256": accepted.attestation_sha256,
            },
        ]
    )
    repository = PostgreSQLReleaseAttestationRepository(factory)
    repository.record_production(rejected)
    repository.record_production(accepted)

    first_query, first_parameters = factory.connection.cursor_instance.executions[0]
    second_query, second_parameters = factory.connection.cursor_instance.executions[1]
    assert "ON CONFLICT (attestation_sha256)" in first_query
    assert "ON CONFLICT (attestation_sha256)" in second_query
    assert first_parameters[1] == second_parameters[1]
    assert first_parameters[0] != second_parameters[0]


@pytest.mark.parametrize("method", ["record_application", "record_production"])
def test_conflicting_attestation_digest_fails_closed(method: str) -> None:
    repository = PostgreSQLReleaseAttestationRepository(_Factory([None]))
    argument = _application() if method == "record_application" else _production()

    with pytest.raises(RuntimeError, match="digest is bound to different evidence"):
        getattr(repository, method)(argument)


def test_persisted_digest_mismatch_fails_closed() -> None:
    attestation = _application()
    factory = _Factory(
        [{"release_id": attestation.release_id, "attestation_sha256": "0" * 64}]
    )

    with pytest.raises(RuntimeError, match="digest does not match"):
        PostgreSQLReleaseAttestationRepository(factory).record_application(attestation)


def test_attestation_objects_reject_manual_production_claim_and_tampering() -> None:
    with pytest.raises(ValueError, match="cannot claim production"):
        replace(
            _application(),
            production_operational_status=ProductionOperationalStatus.ACCEPTED,
        )
    with pytest.raises(ValueError, match="digest does not match"):
        replace(_production(), exact_main_sha="4" * 64)


def test_database_error_rolls_back() -> None:
    factory = _Factory([], fail=True)

    with pytest.raises(RuntimeError, match="database unavailable"):
        PostgreSQLReleaseAttestationRepository(factory).record_application(_application())

    assert factory.connection.committed is False
    assert factory.connection.rolled_back is True
