"""Validation contract for full Git object identifiers."""

from __future__ import annotations

import re

__all__ = ["validate_git_oid"]

_GIT_OBJECT_ID = re.compile(r"^(?:[0-9a-f]{40}|[0-9a-f]{64})$")


def validate_git_oid(value: str, name: str) -> None:
    """Validate a full lowercase Git object ID for SHA-1 or SHA-256 repositories."""
    if _GIT_OBJECT_ID.fullmatch(value) is None:
        raise ValueError(
            f"{name} must be a full lowercase Git object ID (40-char SHA-1 or 64-char SHA-256)"
        )
