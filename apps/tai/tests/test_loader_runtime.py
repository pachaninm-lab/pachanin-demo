from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Any

import pytest

from tai.idempotent_materializer import IdempotentLoaderMaterializer
from tai.loader_runtime import LoaderRuntimeMode, build_loader_materializer


class Sink:
    def store(self, document: object) -> None:
        return None


class Connection(AbstractContextManager["Connection"]):
    def __enter__(self) -> Connection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> AbstractContextManager[Any]:
        raise AssertionError("database should not be touched while composing runtime")

    def commit(self) -> None:
        return None

    def rollback(self) -> None:
        return None


def connection_factory() -> Connection:
    return Connection()


def test_production_runtime_requires_postgresql_authority() -> None:
    with pytest.raises(
        RuntimeError,
        match="production loader materialization requires PostgreSQL authority",
    ):
        build_loader_materializer(mode=LoaderRuntimeMode.PRODUCTION, sink=Sink())


def test_production_runtime_builds_materializer_with_database_authority() -> None:
    materializer = build_loader_materializer(
        mode=LoaderRuntimeMode.PRODUCTION,
        sink=Sink(),
        connection_factory=connection_factory,
    )

    assert isinstance(materializer, IdempotentLoaderMaterializer)


def test_local_runtime_uses_explicit_in_memory_authority() -> None:
    materializer = build_loader_materializer(mode=LoaderRuntimeMode.LOCAL, sink=Sink())

    assert isinstance(materializer, IdempotentLoaderMaterializer)
