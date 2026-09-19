from __future__ import annotations

import hashlib
import json
import re
import stat
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any, Final, cast

_SHA256: Final = re.compile(r"^[0-9a-f]{64}$")
_REVISION: Final = re.compile(r"^[0-9a-f]{40,64}$")
_IDENTITY: Final = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/+@-]{0,199}$")
_RELEASE: Final = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$")
_BINARY_NAMES: Final = frozenset({"llama-cli", "llama-server", "llama-quantize", "llama-bench"})


def _load_json_strict(path: Path) -> dict[str, Any]:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as error:
        raise ValueError(f"cannot read JSON from {path}") from error
    try:
        value = json.loads(text, object_pairs_hook=_reject_duplicate_pairs)
    except json.JSONDecodeError as error:
        raise ValueError(f"cannot parse JSON from {path}") from error
    return _object(value, "root payload")


def _reject_duplicate_pairs(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be a JSON object")
    if any(not isinstance(key, str) for key in value):
        raise ValueError(f"{name} keys must be strings")
    return cast(dict[str, Any], value)


def _expect_keys(
    payload: dict[str, Any],
    required: set[str],
    optional: set[str],
    name: str,
) -> None:
    actual = set(payload)
    missing = sorted(required - actual)
    unknown = sorted(actual - required - optional)
    if missing:
        raise ValueError(f"{name} missing keys: {', '.join(missing)}")
    if unknown:
        raise ValueError(f"{name} unknown keys: {', '.join(unknown)}")


def _array(payload: dict[str, Any], key: str) -> list[object]:
    value = payload.get(key)
    if not isinstance(value, list):
        raise ValueError(f"{key} must be an array")
    return cast(list[object], value)


def _strings(payload: dict[str, Any], key: str) -> list[str]:
    values = _array(payload, key)
    if not values or any(not isinstance(item, str) or not item for item in values):
        raise ValueError(f"{key} must be a non-empty string array")
    return cast(list[str], values)


def _string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return value


def _nullable_string(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be null or a non-empty string")
    return value


def _integer(payload: dict[str, Any], key: str) -> int:
    value = payload.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{key} must be an integer")
    return value


def _optional_object[ResultT](payload: dict[str, Any], key: str, parser: Any) -> ResultT | None:
    value = payload.get(key)
    if value is None:
        return None
    return cast(ResultT, parser(value))


def _canonical_json(payload: object) -> str:
    return json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _bounded_regular_file(root: Path, relative_path: str) -> Path:
    _relative_path(relative_path, "bundle path")
    try:
        root_metadata = root.lstat()
    except OSError as error:
        raise ValueError("root does not exist") from error
    if stat.S_ISLNK(root_metadata.st_mode) or not stat.S_ISDIR(root_metadata.st_mode):
        raise ValueError("root must be a non-symlink directory")
    resolved_root = root.resolve(strict=True)
    current = root
    parts = PurePosixPath(relative_path).parts
    for part in parts:
        current = current / part
        try:
            metadata = current.lstat()
        except OSError as error:
            raise ValueError("file does not exist") from error
        if stat.S_ISLNK(metadata.st_mode):
            raise ValueError("symlink is not allowed")
    resolved = current.resolve(strict=True)
    if resolved_root not in resolved.parents:
        raise ValueError("file escapes bundle root")
    metadata = resolved.stat()
    if not stat.S_ISREG(metadata.st_mode):
        raise ValueError("path is not a regular file")
    return resolved


def _relative_path(value: str, name: str) -> None:
    path = PurePosixPath(value)
    if len(value) > 500:
        raise ValueError(f"{name} is too long")
    if path.is_absolute() or ".." in path.parts or value.startswith("./"):
        raise ValueError(f"{name} must be a bounded relative path")
    if not path.parts or any(part in {"", "."} for part in path.parts):
        raise ValueError(f"{name} must be a bounded relative path")


def _sha256(value: str, name: str) -> None:
    if _SHA256.fullmatch(value) is None:
        raise ValueError(f"{name} must be a lowercase SHA-256 digest")


def _revision(value: str, name: str) -> None:
    if _REVISION.fullmatch(value) is None:
        raise ValueError(f"{name} must be a pinned lowercase commit digest")


def _identity(value: str, name: str) -> None:
    if _IDENTITY.fullmatch(value) is None:
        raise ValueError(f"{name} must be a portable bounded identity")


def _https(value: str, name: str) -> None:
    if not value.startswith("https://"):
        raise ValueError(f"{name} must use HTTPS")


def _bounded_text(value: str, name: str, *, maximum: int) -> None:
    if not value.strip() or len(value) > maximum or "\x00" in value:
        raise ValueError(f"{name} must be non-empty and bounded")


def _parse_timestamp(value: str, name: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{name} must be RFC3339") from error
    if parsed.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")
    return parsed


def _timestamp(value: str, name: str) -> None:
    _parse_timestamp(value, name)


def _argv(value: tuple[str, ...], name: str) -> None:
    if not value or len(value) > 64:
        raise ValueError(f"{name} must be non-empty and bounded")
    for item in value:
        if not item or len(item) > 500 or "\x00" in item or "\n" in item:
            raise ValueError(f"{name} contains an invalid argument")


def _immutable_locator(value: str) -> None:
    if "://" not in value or len(value) > 1_000:
        raise ValueError("immutable locator must be a bounded URI")
    if not any(marker in value for marker in ("@sha256:", "#sha256=", "versionId=")):
        raise ValueError("immutable locator must contain an immutable digest or version")
