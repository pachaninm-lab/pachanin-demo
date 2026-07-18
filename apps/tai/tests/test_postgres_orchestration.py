from __future__ import annotations

import json
from collections.abc import Sequence
from contextlib import AbstractContextManager
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import pytest

from tai.agent_runtime import (
    AgentExecutionResult,
    AgentExecutionStatus,
    PlannedToolCall,
    ToolConfirmation,
)
from tai.contracts import IdentityContext, ToolMode
from tai.orchestration import (
    IdempotencyClaimStatus,
    OrchestrationResponse,
    OrchestrationStatus,
    PreparedAction,
    PreparedActionClaimStatus,
    StoredPreparedAction,
)
from tai.postgres_orchestration import (
    PostgreSQLOrchestrationIdempotencyRepository,
    PostgreSQLPreparedActionRepository,
    _execution_payload,
    _response_payload,
    _stored_action_payload,
)

NOW = datetime(2026, 7, 18, 22, 0, tzinfo=UTC)
TRACE_ID = UUID("11111111-1111-4111-8111-111111111111")
PLAN_ID = UUID("22222222-2222-4222-8222-222222222222")
CONFIRMATION_ID = UUID("33333333-3333-4333-8333-333333333333")
USER_ID = UUID("44444444-4444-4444-8444-444444444444")
TENANT_ID = UUID("55555555-5555-4555-8555-555555555555")
SESSION_ID = UUID("66666666-6666-4666-8666-666666666666")
EXECUTION_TOKEN = UUID("77777777-7777-4777-8777-777777777777")
OTHER_EXECUTION_TOKEN = UUID("88888888-8888-4888-8888-888888888888")
SCOPE_SHA = "a" * 64
REQUEST_SHA = "b" * 64


class FakeCursor(AbstractContextManager["FakeCursor"]):
    def __init__(
        self,
        rows: list[dict[str, Any] | None],
        *,
        fail: bool = False,
    ) -> None:
        self.rows = list(rows)
        self.fail = fail
        self.queries: list[str] = []
        self.parameters: list[tuple[Any, ...]] = []

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None:
        if self.fail:
            raise RuntimeError("database failure")
        self.queries.append(query)
        self.parameters.append(tuple(parameters))

    def fetchone(self) -> dict[str, Any] | None:
        if not self.rows:
            return None
        return self.rows.pop(0)


class FakeConnection(AbstractContextManager["FakeConnection"]):
    def __init__(
        self,
        rows: list[dict[str, Any] | None],
        *,
        fail: bool = False,
    ) -> None:
        self.cursor_instance = FakeCursor(rows, fail=fail)
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> FakeConnection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> FakeCursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class FakeFactory:
    def __init__(
        self,
        rows: list[dict[str, Any] | None],
        *,
        fail: bool = False,
    ) -> None:
        self.connection = FakeConnection(rows, fail=fail)

    def __call__(self) -> FakeConnection:
        return self.connection


def _identity() -> IdentityContext:
    return IdentityContext(
        user_id=USER_ID,
        tenant_id=TENANT_ID,
        roles=frozenset({"buyer"}),
        session_id=SESSION_ID,
        mfa_verified=True,
    )


def _prepared() -> StoredPreparedAction:
    call = PlannedToolCall(
        call_id="release-payment",
        tool_name="settlement.release",
        arguments={"deal_id": "deal-42"},
        requested_mode=ToolMode.CONFIRMED_WRITE,
    )
    confirmation = ToolConfirmation(
        confirmation_id=CONFIRMATION_ID,
        call_id=call.call_id,
        request_sha256=REQUEST_SHA,
        user_id=USER_ID,
        tenant_id=TENANT_ID,
        session_id=SESSION_ID,
        issued_at=NOW,
        expires_at=NOW + timedelta(minutes=5),
        mfa_verified=True,
        signature_sha256="c" * 64,
    )
    return StoredPreparedAction(
        action=PreparedAction(
            trace_id=TRACE_ID,
            plan_id=PLAN_ID,
            call=call,
            confirmation=confirmation,
        ),
        identity=_identity(),
    )


def _result() -> AgentExecutionResult:
    return AgentExecutionResult(
        trace_id=TRACE_ID,
        plan_id=PLAN_ID,
        status=AgentExecutionStatus.COMPLETED,
        plan_sha256="d" * 64,
        calls=(),
        completed_at=NOW + timedelta(seconds=1),
    )


def _response() -> OrchestrationResponse:
    return OrchestrationResponse(
        request_id="request-00000001",
        trace_id=TRACE_ID,
        status=OrchestrationStatus.ANSWERED,
        answer="Сделка готова к следующему действию.",
        citations=(),
        knowledge_generation=7,
        model_id="tai-local-8b",
        model_revision="q4-r1",
        model_route_id="route-primary",
        tool_execution=None,
        prepared_actions=(_prepared().action,),
        reason=None,
        completed_at=NOW,
    )


def _prepared_row(
    status: str,
    *,
    result: AgentExecutionResult | None = None,
    execution_token: UUID | None = None,
) -> dict[str, Any]:
    return {
        "prepared_payload": _stored_action_payload(_prepared()),
        "result_payload": None if result is None else _execution_payload(result),
        "status": status,
        "execution_token": execution_token,
    }


def test_idempotency_claim_maps_new_in_progress_and_conflict() -> None:
    new_factory = FakeFactory(
        [
            {
                "request_sha256": REQUEST_SHA,
                "status": "IN_PROGRESS",
                "response_payload": None,
                "inserted": True,
            }
        ]
    )
    new_claim = PostgreSQLOrchestrationIdempotencyRepository(new_factory).claim(
        SCOPE_SHA,
        REQUEST_SHA,
    )
    assert new_claim.status is IdempotencyClaimStatus.NEW
    assert "xmax = 0" in new_factory.connection.cursor_instance.queries[0]
    assert new_factory.connection.committed is True

    in_progress = PostgreSQLOrchestrationIdempotencyRepository(
        FakeFactory(
            [
                {
                    "request_sha256": REQUEST_SHA,
                    "status": "IN_PROGRESS",
                    "response_payload": None,
                    "inserted": False,
                }
            ]
        )
    ).claim(SCOPE_SHA, REQUEST_SHA)
    assert in_progress.status is IdempotencyClaimStatus.IN_PROGRESS

    conflict = PostgreSQLOrchestrationIdempotencyRepository(
        FakeFactory(
            [
                {
                    "request_sha256": "e" * 64,
                    "status": "IN_PROGRESS",
                    "response_payload": None,
                    "inserted": False,
                }
            ]
        )
    ).claim(SCOPE_SHA, REQUEST_SHA)
    assert conflict.status is IdempotencyClaimStatus.CONFLICT


def test_idempotency_claim_replays_json_payload() -> None:
    response = _response()
    payload = _response_payload(response)
    claim = PostgreSQLOrchestrationIdempotencyRepository(
        FakeFactory(
            [
                {
                    "request_sha256": REQUEST_SHA,
                    "status": "COMPLETED",
                    "response_payload": json.dumps(payload),
                    "inserted": False,
                }
            ]
        )
    ).claim(SCOPE_SHA, REQUEST_SHA)

    assert claim.status is IdempotencyClaimStatus.REPLAY
    assert claim.response == response


def test_idempotency_claim_fails_closed_on_invalid_state() -> None:
    repository = PostgreSQLOrchestrationIdempotencyRepository(FakeFactory([None]))
    with pytest.raises(RuntimeError, match="did not return"):
        repository.claim(SCOPE_SHA, REQUEST_SHA)

    missing_payload = FakeFactory(
        [
            {
                "request_sha256": REQUEST_SHA,
                "status": "COMPLETED",
                "response_payload": None,
                "inserted": False,
            }
        ]
    )
    with pytest.raises(RuntimeError, match="missing response"):
        PostgreSQLOrchestrationIdempotencyRepository(missing_payload).claim(
            SCOPE_SHA,
            REQUEST_SHA,
        )

    unknown = FakeFactory(
        [
            {
                "request_sha256": REQUEST_SHA,
                "status": "BROKEN",
                "response_payload": None,
                "inserted": False,
            }
        ]
    )
    with pytest.raises(RuntimeError, match="unknown"):
        PostgreSQLOrchestrationIdempotencyRepository(unknown).claim(
            SCOPE_SHA,
            REQUEST_SHA,
        )


def test_idempotency_complete_is_atomic_and_replay_idempotent() -> None:
    response = _response()
    payload = _response_payload(response)
    direct = FakeFactory(
        [
            {
                "request_sha256": REQUEST_SHA,
                "status": "COMPLETED",
                "response_payload": payload,
            }
        ]
    )
    PostgreSQLOrchestrationIdempotencyRepository(direct).complete(
        SCOPE_SHA,
        REQUEST_SHA,
        response,
    )
    assert direct.connection.committed is True
    assert len(direct.connection.cursor_instance.queries) == 1

    replay = FakeFactory(
        [
            None,
            {
                "request_sha256": REQUEST_SHA,
                "status": "COMPLETED",
                "response_payload": json.dumps(payload),
            },
        ]
    )
    PostgreSQLOrchestrationIdempotencyRepository(replay).complete(
        SCOPE_SHA,
        REQUEST_SHA,
        response,
    )
    assert len(replay.connection.cursor_instance.queries) == 2


def test_idempotency_complete_rejects_conflict_and_abandon_deletes_claim() -> None:
    response = _response()
    conflict = FakeFactory(
        [
            None,
            {
                "request_sha256": REQUEST_SHA,
                "status": "COMPLETED",
                "response_payload": {"different": True},
            },
        ]
    )
    with pytest.raises(RuntimeError, match="immutable"):
        PostgreSQLOrchestrationIdempotencyRepository(conflict).complete(
            SCOPE_SHA,
            REQUEST_SHA,
            response,
        )
    assert conflict.connection.rolled_back is True

    abandon = FakeFactory([])
    PostgreSQLOrchestrationIdempotencyRepository(abandon).abandon(
        SCOPE_SHA,
        REQUEST_SHA,
    )
    cursor = abandon.connection.cursor_instance
    assert "DELETE FROM tai_orchestration_idempotency" in cursor.queries[0]
    assert cursor.parameters[0] == (SCOPE_SHA, REQUEST_SHA)


def test_prepared_action_lease_policy_is_bounded() -> None:
    with pytest.raises(ValueError, match="execution_lease"):
        PostgreSQLPreparedActionRepository(
            FakeFactory([]),
            execution_lease=timedelta(0),
        )
    with pytest.raises(ValueError, match="execution_lease"):
        PostgreSQLPreparedActionRepository(
            FakeFactory([]),
            execution_lease=timedelta(hours=2),
        )


def test_prepared_action_save_get_and_identity_conflict() -> None:
    prepared = _prepared()
    save_factory = FakeFactory([{"confirmation_id": CONFIRMATION_ID}])
    PostgreSQLPreparedActionRepository(save_factory).save(prepared)
    cursor = save_factory.connection.cursor_instance
    assert "ON CONFLICT (confirmation_id) DO UPDATE" in cursor.queries[0]
    assert cursor.parameters[0][0] == CONFIRMATION_ID
    assert cursor.parameters[0][9] == _stored_action_payload(prepared)

    get_factory = FakeFactory([_prepared_row("PREPARED")])
    restored = PostgreSQLPreparedActionRepository(get_factory).get(CONFIRMATION_ID)
    assert restored == prepared

    assert (
        PostgreSQLPreparedActionRepository(FakeFactory([None])).get(CONFIRMATION_ID)
        is None
    )
    with pytest.raises(RuntimeError, match="identity conflict"):
        PostgreSQLPreparedActionRepository(FakeFactory([None])).save(prepared)


def test_prepared_action_claim_is_leased_fenced_and_replayable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "tai.postgres_orchestration.uuid4",
        lambda: EXECUTION_TOKEN,
    )
    execute_factory = FakeFactory(
        [_prepared_row("EXECUTING", execution_token=EXECUTION_TOKEN)]
    )
    execute = PostgreSQLPreparedActionRepository(execute_factory).claim(
        CONFIRMATION_ID
    )
    assert execute.status is PreparedActionClaimStatus.EXECUTE
    assert execute.prepared.executing is True
    cursor = execute_factory.connection.cursor_instance
    assert "execution_expires_at <= clock_timestamp()" in cursor.queries[0]
    assert cursor.parameters[0] == (EXECUTION_TOKEN, 300, CONFIRMATION_ID)

    in_progress = PostgreSQLPreparedActionRepository(
        FakeFactory(
            [
                None,
                _prepared_row(
                    "EXECUTING",
                    execution_token=OTHER_EXECUTION_TOKEN,
                ),
            ]
        )
    ).claim(CONFIRMATION_ID)
    assert in_progress.status is PreparedActionClaimStatus.IN_PROGRESS

    replay = PostgreSQLPreparedActionRepository(
        FakeFactory([None, _prepared_row("COMPLETED", result=_result())])
    ).claim(CONFIRMATION_ID)
    assert replay.status is PreparedActionClaimStatus.REPLAY
    assert replay.prepared.result == _result()


def test_prepared_action_claim_rejects_fencing_mismatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "tai.postgres_orchestration.uuid4",
        lambda: EXECUTION_TOKEN,
    )
    repository = PostgreSQLPreparedActionRepository(
        FakeFactory(
            [
                _prepared_row(
                    "EXECUTING",
                    execution_token=OTHER_EXECUTION_TOKEN,
                )
            ]
        )
    )
    with pytest.raises(RuntimeError, match="fencing token mismatch"):
        repository.claim(CONFIRMATION_ID)


def test_prepared_action_claim_rejects_missing_and_corrupt_rows() -> None:
    with pytest.raises(RuntimeError, match="does not exist"):
        PostgreSQLPreparedActionRepository(FakeFactory([None, None])).claim(
            CONFIRMATION_ID
        )

    with pytest.raises(RuntimeError, match="missing its result"):
        PostgreSQLPreparedActionRepository(
            FakeFactory([None, _prepared_row("COMPLETED")])
        ).claim(CONFIRMATION_ID)

    with pytest.raises(RuntimeError, match="unknown"):
        PostgreSQLPreparedActionRepository(
            FakeFactory([None, _prepared_row("BROKEN")])
        ).claim(CONFIRMATION_ID)


def test_claimed_action_completion_is_fenced(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "tai.postgres_orchestration.uuid4",
        lambda: EXECUTION_TOKEN,
    )
    result = _result()
    factory = FakeFactory(
        [
            _prepared_row("EXECUTING", execution_token=EXECUTION_TOKEN),
            _prepared_row("COMPLETED", result=result),
        ]
    )
    repository = PostgreSQLPreparedActionRepository(factory)
    claim = repository.claim(CONFIRMATION_ID)
    assert claim.status is PreparedActionClaimStatus.EXECUTE

    completed = repository.complete(CONFIRMATION_ID, result)
    assert completed.result == result
    cursor = factory.connection.cursor_instance
    assert "execution_expires_at > clock_timestamp()" in cursor.queries[1]
    assert cursor.parameters[1][3] == EXECUTION_TOKEN


def test_prepared_action_complete_and_abandon_are_idempotent() -> None:
    result = _result()
    completed_row = _prepared_row("COMPLETED", result=result)
    direct = FakeFactory([completed_row])
    completed = PostgreSQLPreparedActionRepository(direct).complete(
        CONFIRMATION_ID,
        result,
    )
    assert completed.result == result
    assert completed.executing is False

    replay = FakeFactory([None, completed_row])
    replayed = PostgreSQLPreparedActionRepository(replay).complete(
        CONFIRMATION_ID,
        result,
    )
    assert replayed.result == result
    assert len(replay.connection.cursor_instance.queries) == 2

    abandon = FakeFactory([])
    PostgreSQLPreparedActionRepository(abandon).abandon(CONFIRMATION_ID)
    cursor = abandon.connection.cursor_instance
    assert "status = 'PREPARED'" in cursor.queries[0]
    assert "execution_token IS NOT DISTINCT FROM %s" in cursor.queries[0]
    assert cursor.parameters[0] == (CONFIRMATION_ID, None)


def test_prepared_action_complete_rejects_stale_or_immutable_result() -> None:
    result = _result()
    stale = FakeFactory(
        [
            None,
            _prepared_row(
                "EXECUTING",
                execution_token=OTHER_EXECUTION_TOKEN,
            ),
        ]
    )
    with pytest.raises(RuntimeError, match="stale or expired"):
        PostgreSQLPreparedActionRepository(stale).complete(
            CONFIRMATION_ID,
            result,
        )
    assert stale.connection.rolled_back is True

    conflict = FakeFactory(
        [
            None,
            {
                **_prepared_row("COMPLETED", result=result),
                "result_payload": {"different": True},
            },
        ]
    )
    with pytest.raises(RuntimeError, match="immutable"):
        PostgreSQLPreparedActionRepository(conflict).complete(
            CONFIRMATION_ID,
            result,
        )
    assert conflict.connection.rolled_back is True


def test_database_failure_rolls_back() -> None:
    factory = FakeFactory([], fail=True)
    with pytest.raises(RuntimeError, match="database failure"):
        PostgreSQLOrchestrationIdempotencyRepository(factory).claim(
            SCOPE_SHA,
            REQUEST_SHA,
        )
    assert factory.connection.committed is False
    assert factory.connection.rolled_back is True
