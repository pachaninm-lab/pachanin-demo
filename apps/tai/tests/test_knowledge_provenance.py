"""D.05: every fact carries provenance, freshness, authority and expiry.

A fact without those is a sentence someone wrote once. The tests below are about
the difference: a record that cannot say when it was last confirmed must not be
constructible, and one whose horizon has passed must not be retrievable — not
retrievable-with-a-warning, because a warning attached to a fact is lost the
moment the answer is written.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from tai.knowledge import (
    DEFAULT_PLATFORM_KNOWLEDGE,
    FactAuthority,
    KnowledgeRecord,
    KnowledgeScope,
    KnowledgeStore,
)

NOW = datetime(2026, 7, 28, tzinfo=UTC)


def record(**overrides: object) -> KnowledgeRecord:
    fields: dict[str, object] = {
        "record_id": "fact.one",
        "title": "Приёмка зерна",
        "body": "Партия принимается по результатам лабораторного анализа.",
        "version": "1",
        "source_uri": "repo://docs/acceptance",
        "effective_at": NOW - timedelta(days=10),
        "trust_score": 1.0,
        "authority": FactAuthority.PLATFORM_CODE,
        "observed_at": NOW - timedelta(days=10),
        "expires_at": NOW + timedelta(days=30),
    }
    fields.update(overrides)
    return KnowledgeRecord(**fields)  # type: ignore[arg-type]


class TestAFactMustBeAbleToAccountForItself:
    def test_a_naive_timestamp_is_refused(self) -> None:
        # Without a zone, "expired" depends on where the reader is standing.
        with pytest.raises(ValueError, match="timezone-aware"):
            record(observed_at=datetime(2026, 7, 18))

    def test_a_fact_observed_before_it_took_effect_is_refused(self) -> None:
        with pytest.raises(ValueError, match="must not precede"):
            record(observed_at=NOW - timedelta(days=20))

    def test_an_expiry_that_precedes_the_observation_is_refused(self) -> None:
        with pytest.raises(ValueError, match="must follow"):
            record(expires_at=NOW - timedelta(days=11))

    def test_an_official_fact_must_name_its_registered_source(self) -> None:
        with pytest.raises(ValueError, match="must name its registered source"):
            record(authority=FactAuthority.OFFICIAL_SOURCE)

    def test_a_platform_fact_may_not_borrow_a_source_registration(self) -> None:
        # Claiming a registered source lends the weight of an official record to
        # something nobody checked against it.
        with pytest.raises(ValueError, match="only an official-source fact"):
            record(source_id="official.minselhoz")

    def test_an_official_fact_that_names_its_source_is_accepted(self) -> None:
        item = record(
            authority=FactAuthority.OFFICIAL_SOURCE, source_id="official.minselhoz"
        )

        assert item.source_id == "official.minselhoz"


class TestExpiryDropsTheFactRatherThanFlaggingIt:
    def test_a_fact_in_force_is_retrieved(self) -> None:
        store = KnowledgeStore((record(),))

        results = store.retrieve("приёмка", tenant_id=None, now=NOW)

        assert [item.record.record_id for item in results] == ["fact.one"]

    def test_an_expired_fact_is_not_retrieved_at_all(self) -> None:
        store = KnowledgeStore((record(),))

        results = store.retrieve("приёмка", tenant_id=None, now=NOW + timedelta(days=31))

        assert results == ()

    def test_a_fact_is_not_retrieved_before_it_takes_effect(self) -> None:
        store = KnowledgeStore((record(effective_at=NOW + timedelta(days=1),
                                       observed_at=NOW + timedelta(days=1),
                                       expires_at=NOW + timedelta(days=40)),))

        results = store.retrieve("приёмка", tenant_id=None, now=NOW)

        assert results == ()

    def test_expiry_is_checked_at_the_boundary_not_after_it(self) -> None:
        # The horizon is the first moment the fact may not be stated.
        store = KnowledgeStore((record(),))

        assert store.retrieve("приёмка", tenant_id=None, now=NOW + timedelta(days=30)) == ()
        assert store.retrieve(
            "приёмка", tenant_id=None, now=NOW + timedelta(days=30) - timedelta(seconds=1)
        ) != ()

    def test_expiry_does_not_override_tenant_isolation(self) -> None:
        # A fresh tenant fact still belongs to its tenant only.
        other = uuid4()
        store = KnowledgeStore(
            (record(scope=KnowledgeScope.TENANT, tenant_id=uuid4()),)
        )

        assert store.retrieve("приёмка", tenant_id=other, now=NOW) == ()


class TestTheShippedPlatformFactsCarryTheMetadata:
    def test_every_default_fact_declares_authority_freshness_and_expiry(self) -> None:
        store = DEFAULT_PLATFORM_KNOWLEDGE
        results = store.retrieve("сделка роль этапы", tenant_id=None, now=NOW)

        assert results, "the shipped platform facts must be retrievable today"
        for item in results:
            assert item.record.authority is FactAuthority.PLATFORM_CODE
            assert item.record.observed_at.tzinfo is not None
            assert item.record.expires_at > item.record.observed_at

    def test_the_shipped_facts_stop_being_usable_without_re_confirmation(self) -> None:
        # Not a formality: a platform fact held indefinitely is a claim about
        # code nobody re-read. The horizon forces the re-reading.
        store = DEFAULT_PLATFORM_KNOWLEDGE

        assert store.retrieve("сделка", tenant_id=None, now=datetime(2027, 6, 1, tzinfo=UTC)) == ()
