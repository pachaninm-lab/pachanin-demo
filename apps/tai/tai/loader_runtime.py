from __future__ import annotations

from enum import StrEnum

from tai.idempotent_materializer import (
    DocumentSink,
    IdempotentLoaderMaterializer,
    InMemoryMaterializationClaimRepository,
    MaterializationClaimRepository,
)
from tai.postgres_loader_state import ConnectionFactory
from tai.postgres_materialization_claims import PostgreSQLMaterializationClaimRepository


class LoaderRuntimeMode(StrEnum):
    LOCAL = "LOCAL"
    TEST = "TEST"
    PRODUCTION = "PRODUCTION"


def build_loader_materializer(
    *,
    mode: LoaderRuntimeMode,
    sink: DocumentSink,
    connection_factory: ConnectionFactory | None = None,
) -> IdempotentLoaderMaterializer:
    claims: MaterializationClaimRepository
    if mode is LoaderRuntimeMode.PRODUCTION:
        if connection_factory is None:
            raise RuntimeError("production loader materialization requires PostgreSQL authority")
        claims = PostgreSQLMaterializationClaimRepository(connection_factory)
    else:
        claims = InMemoryMaterializationClaimRepository()

    return IdempotentLoaderMaterializer(claims=claims, sink=sink)
