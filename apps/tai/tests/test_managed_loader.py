from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from tai.managed_loader import (
    DocumentNormalizer,
    FetchDisposition,
    FetchRequest,
    FetchResponse,
    LoaderSchedule,
    ManagedSourceLoader,
    NormalizationInput,
)
from tai.source_governance import DEFAULT_AGRO_SOURCE_REGISTRY, KnowledgeDomain


NOW = datetime(2026, 7, 18, 12, tzinfo=UTC)


@dataclass
class StubFetcher:
    response: FetchResponse

    def fetch(self, request: FetchRequest) -> FetchResponse:
        assert request.source_uri.startswith("https://")
        return self.response


def make_loader(response: FetchResponse) -> ManagedSourceLoader:
    return ManagedSourceLoader(
        fetcher=StubFetcher(response),
        normalizer=DocumentNormalizer(),
        registry=DEFAULT_AGRO_SOURCE_REGISTRY,
        schedule=LoaderSchedule(
            source_id="official.minselhoz",
            interval=timedelta(days=1),
            retry_interval=timedelta(hours=1),
            maximum_failures=3,
        ),
    )


def test_normalizer_produces_canonical_checksum() -> None:
    document = DocumentNormalizer().normalize(
        NormalizationInput(
            source_id="official.minselhoz",
            source_uri="https://mcx.gov.ru/report",
            title="  Отчёт   рынка ",
            raw_body=" Первая строка  \n\n Вторая строка ",
            published_at=NOW,
            effective_at=NOW,
            fetched_at=NOW,
            trust_score=0.99,
            domain=KnowledgeDomain.MARKET,
        )
    )

    assert document.title == "Отчёт рынка"
    assert document.body == "Первая строка\nВторая строка"
    assert len(document.checksum_sha256) == 64


def test_loader_admits_normalized_official_document() -> None:
    loader = make_loader(
        FetchResponse(
            disposition=FetchDisposition.FETCHED,
            body=" Урожай зерна обновлён ",
            fetched_at=NOW,
            etag='"v1"',
        )
    )

    result = loader.run(
        request=FetchRequest(
            source_id="official.minselhoz",
            source_uri="https://mcx.gov.ru/report",
        ),
        title="Рынок зерна",
        published_at=NOW,
        effective_at=NOW,
        trust_score=0.99,
        domain=KnowledgeDomain.MARKET,
    )

    assert result.document is not None
    assert result.reasons == ()
    assert result.etag == '"v1"'
    assert result.next_run_at == NOW + timedelta(days=1)


def test_loader_handles_not_modified_without_materialization() -> None:
    loader = make_loader(
        FetchResponse(
            disposition=FetchDisposition.NOT_MODIFIED,
            body=None,
            fetched_at=NOW,
            etag='"v1"',
        )
    )

    result = loader.run(
        request=FetchRequest(
            source_id="official.minselhoz",
            source_uri="https://mcx.gov.ru/report",
            etag='"v1"',
        ),
        title="Рынок зерна",
        published_at=NOW,
        effective_at=NOW,
        trust_score=0.99,
        domain=KnowledgeDomain.MARKET,
    )

    assert result.document is None
    assert result.reasons == ("source_not_modified",)
    assert result.next_run_at == NOW + timedelta(days=1)


def test_retryable_failure_uses_retry_schedule() -> None:
    loader = make_loader(
        FetchResponse(
            disposition=FetchDisposition.RETRYABLE_FAILURE,
            body=None,
            fetched_at=NOW,
            error_code="upstream_timeout",
        )
    )

    result = loader.run(
        request=FetchRequest(
            source_id="official.minselhoz",
            source_uri="https://mcx.gov.ru/report",
        ),
        title="Рынок зерна",
        published_at=NOW,
        effective_at=NOW,
        trust_score=0.99,
        domain=KnowledgeDomain.MARKET,
        consecutive_failures=1,
    )

    assert result.document is None
    assert result.reasons == ("upstream_timeout",)
    assert result.next_run_at == NOW + timedelta(hours=1)


def test_failure_budget_stops_retry_loop() -> None:
    loader = make_loader(
        FetchResponse(
            disposition=FetchDisposition.RETRYABLE_FAILURE,
            body=None,
            fetched_at=NOW,
        )
    )

    result = loader.run(
        request=FetchRequest(
            source_id="official.minselhoz",
            source_uri="https://mcx.gov.ru/report",
        ),
        title="Рынок зерна",
        published_at=NOW,
        effective_at=NOW,
        trust_score=0.99,
        domain=KnowledgeDomain.MARKET,
        consecutive_failures=3,
    )

    assert result.next_run_at is None


def test_loader_rejects_document_that_fails_source_policy() -> None:
    loader = make_loader(
        FetchResponse(
            disposition=FetchDisposition.FETCHED,
            body="Рынок",
            fetched_at=NOW,
        )
    )

    result = loader.run(
        request=FetchRequest(
            source_id="official.minselhoz",
            source_uri="https://untrusted.example/report",
        ),
        title="Рынок зерна",
        published_at=NOW,
        effective_at=NOW,
        trust_score=0.99,
        domain=KnowledgeDomain.MARKET,
    )

    assert result.document is None
    assert result.reasons == ("source_host_not_allowed",)


def test_missing_fetched_body_fails_closed() -> None:
    loader = make_loader(
        FetchResponse(
            disposition=FetchDisposition.FETCHED,
            body=None,
            fetched_at=NOW,
        )
    )

    result = loader.run(
        request=FetchRequest(
            source_id="official.minselhoz",
            source_uri="https://mcx.gov.ru/report",
        ),
        title="Рынок зерна",
        published_at=NOW,
        effective_at=NOW,
        trust_score=0.99,
        domain=KnowledgeDomain.MARKET,
    )

    assert result.disposition is FetchDisposition.PERMANENT_FAILURE
    assert result.reasons == ("fetched_body_missing",)
    assert result.next_run_at is None
