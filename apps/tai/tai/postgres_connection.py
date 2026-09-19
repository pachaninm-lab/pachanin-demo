from __future__ import annotations

import re
from contextlib import AbstractContextManager
from dataclasses import dataclass
from typing import cast
from urllib.parse import urlsplit

import psycopg
from psycopg.rows import dict_row

from tai.postgres_loader_state import DatabaseConnection

_APPLICATION_NAME = re.compile(r"^[A-Za-z0-9._:-]{1,64}$")


@dataclass(frozen=True, slots=True)
class PsycopgConnectionFactory:
    """Create short-lived mapped-row PostgreSQL connections with bounded setup."""

    dsn: str
    connect_timeout_seconds: int = 5
    application_name: str = "tai-api"

    def __post_init__(self) -> None:
        normalized = self.dsn.strip()
        parsed = urlsplit(normalized)
        if parsed.scheme not in {"postgres", "postgresql"}:
            raise ValueError("TAI database DSN must use postgres or postgresql")
        if parsed.hostname is None:
            raise ValueError("TAI database DSN must contain a host")
        if any(ord(character) < 32 for character in normalized):
            raise ValueError("TAI database DSN must not contain control characters")
        if not 1 <= self.connect_timeout_seconds <= 30:
            raise ValueError("database connect timeout must be between 1 and 30 seconds")
        if _APPLICATION_NAME.fullmatch(self.application_name) is None:
            raise ValueError("database application name must be bounded and portable")
        object.__setattr__(self, "dsn", normalized)

    def __call__(self) -> AbstractContextManager[DatabaseConnection]:
        connection = psycopg.connect(
            self.dsn,
            connect_timeout=self.connect_timeout_seconds,
            application_name=self.application_name,
            row_factory=dict_row,
            autocommit=False,
        )
        return cast(AbstractContextManager[DatabaseConnection], connection)
