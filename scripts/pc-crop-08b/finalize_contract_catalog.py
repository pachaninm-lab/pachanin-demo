#!/usr/bin/env python3
"""Finalize human-reviewable committed PC-CROP-08B catalog outputs.

The authoritative parser writes compact deterministic JSON. This step rewrites
that semantic document to stable sorted/indented JSON, pins the final byte hash
in the lock and generated TypeScript metadata, and leaves no timestamps.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

CATALOG_HASH_PATTERN = re.compile(
    r'(FGIS_GRAIN_1_0_23_CATALOG_SHA256\s*=\s*")[0-9a-f]{64}("\s+as const;)',
)


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def stable_pretty(value: object) -> bytes:
    return (
        json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            indent=2,
        )
        + "\n"
    ).encode("utf-8")


def stable_compact(value: object) -> bytes:
    return (
        json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    ).encode("utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-catalog", required=True, type=Path)
    parser.add_argument("--raw-lock", required=True, type=Path)
    parser.add_argument("--raw-typescript", required=True, type=Path)
    parser.add_argument("--catalog-output", required=True, type=Path)
    parser.add_argument("--lock-output", required=True, type=Path)
    parser.add_argument("--typescript-output", required=True, type=Path)
    args = parser.parse_args()

    catalog = json.loads(args.raw_catalog.read_text("utf-8"))
    lock = json.loads(args.raw_lock.read_text("utf-8"))
    if catalog.get("schemaVersion") != "pc-crop.fgis-grain-operation-catalog.v1":
        raise SystemExit("unexpected catalog schema")
    if lock.get("operationCount") != 57 or lock.get("transportOperationCount") != 3:
        raise SystemExit("catalog cardinality drift")

    catalog_payload = stable_pretty(catalog)
    catalog_hash = sha256(catalog_payload)
    lock["catalogSha256"] = catalog_hash
    lock_payload = stable_compact(lock)

    source = args.raw_typescript.read_text("utf-8")
    typescript, replacements = CATALOG_HASH_PATTERN.subn(
        rf'\g<1>{catalog_hash}\g<2>',
        source,
        count=1,
    )
    if replacements != 1:
        raise SystemExit("generated TypeScript catalog hash marker missing")

    for path, payload in (
        (args.catalog_output, catalog_payload),
        (args.lock_output, lock_payload),
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
    args.typescript_output.parent.mkdir(parents=True, exist_ok=True)
    args.typescript_output.write_text(typescript, encoding="utf-8")

    print(json.dumps({
        "catalogSha256": catalog_hash,
        "operationCount": lock["operationCount"],
        "transportOperationCount": lock["transportOperationCount"],
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
