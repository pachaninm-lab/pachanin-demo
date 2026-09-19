#!/usr/bin/env python3
"""Normalize and hash the committed PC-CROP-08B operation catalog."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

CATALOG_HASH_PATTERN = re.compile(
    r'(FGIS_GRAIN_1_0_23_CATALOG_SHA256\s*=\s*")[0-9a-f]{64}("\s+as const;)',
)
BUSINESS_OPERATIONS_PATTERN = re.compile(
    r'export const FGIS_GRAIN_1_0_23_BUSINESS_OPERATIONS = \[.*?\] as const;\n'
    r'export type FgisGrainBusinessOperation = .*?;\n'
    r'export type FgisGrainBusinessOperationCode = .*?;',
    re.DOTALL,
)
OPERATION_FIELDS = [
    "code",
    "name",
    "family",
    "classification",
    "requestLocalName",
    "responseLocalName",
]
FAMILY_FIELDS = [
    "code",
    "namespace",
    "schemaFile",
    "schemaFileSha256",
    "operationCount",
    "readCount",
    "mutationCount",
]
TRANSPORT_FIELDS = [
    "name",
    "soapAction",
    "inputQName",
    "outputQName",
    "faultQName",
]


def encode(value: object) -> bytes:
    return (
        json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    ).encode("utf-8")


def render_operation_codes(codes: list[str]) -> str:
    body = "\n".join(f"  {json.dumps(code)}," for code in codes)
    return (
        "export const FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_CODES = [\n"
        + body
        + "\n] as const;\n"
        + "export type FgisGrainBusinessOperationCode = "
        + "typeof FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_CODES[number];"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-catalog", type=Path, required=True)
    parser.add_argument("--raw-lock", type=Path, required=True)
    parser.add_argument("--raw-typescript", type=Path, required=True)
    parser.add_argument("--catalog-output", type=Path, required=True)
    parser.add_argument("--lock-output", type=Path, required=True)
    parser.add_argument("--typescript-output", type=Path, required=True)
    args = parser.parse_args()

    raw = json.loads(args.raw_catalog.read_text("utf-8"))
    lock = json.loads(args.raw_lock.read_text("utf-8"))
    family_detail = {
        row["code"]: row for row in raw["business"]["families"]
    }
    family_sources: dict[str, tuple[str, str, str]] = {}
    for operation in raw["business"]["operations"]:
        current = (
            operation["namespace"],
            operation["schemaFile"],
            operation["schemaFileSha256"],
        )
        previous = family_sources.setdefault(operation["family"], current)
        if previous != current:
            raise SystemExit("family source drift")

    families = []
    for code in sorted(family_sources):
        namespace, schema_file, schema_sha = family_sources[code]
        detail = family_detail[code]
        families.append([
            code,
            namespace,
            schema_file,
            schema_sha,
            detail["operationCount"],
            detail["readCount"],
            detail["mutationCount"],
        ])

    operations = []
    for operation in raw["business"]["operations"]:
        namespace = operation["namespace"]
        prefix = "{" + namespace + "}"
        request_qname = operation["request"]["qname"]
        response_qname = operation["response"]["qname"]
        if (
            not request_qname.startswith(prefix)
            or not response_qname.startswith(prefix)
        ):
            raise SystemExit("QName namespace drift")
        operations.append([
            operation["code"],
            operation["name"],
            operation["family"],
            operation["classification"],
            request_qname[len(prefix):],
            response_qname[len(prefix):],
        ])

    normalized = {
        "schemaVersion": raw["schemaVersion"],
        "adapter": raw["adapter"],
        "sourceAuthority": raw["sourceAuthority"],
        "transport": {
            **{
                key: raw["transport"][key]
                for key in (
                    "targetNamespace",
                    "portType",
                    "binding",
                    "soapVersion",
                    "style",
                    "service",
                    "port",
                    "documentationEndpoint",
                )
            },
            "fields": TRANSPORT_FIELDS,
            "operations": [
                [
                    row["name"],
                    row["soapAction"],
                    row["input"]["element"],
                    row["output"]["element"],
                    row["fault"]["element"],
                ]
                for row in raw["transport"]["operations"]
            ],
        },
        "business": {
            "familyFields": FAMILY_FIELDS,
            "families": families,
            "operationFields": OPERATION_FIELDS,
            "operationCount": len(operations),
            "operations": operations,
        },
        "enums": raw["enums"],
        "sdizIdentifiers": sorted({
            row["name"] for row in raw["sdizIdentifiers"]
        }),
        "boundaries": raw["boundaries"],
    }
    if len(operations) != 57 or len(normalized["transport"]["operations"]) != 3:
        raise SystemExit("catalog cardinality drift")

    catalog_payload = encode(normalized)
    catalog_hash = hashlib.sha256(catalog_payload).hexdigest()
    lock["catalogSha256"] = catalog_hash
    source = args.raw_typescript.read_text("utf-8")
    source, operation_replacements = BUSINESS_OPERATIONS_PATTERN.subn(
        render_operation_codes([row[0] for row in operations]),
        source,
        count=1,
    )
    if operation_replacements != 1:
        raise SystemExit("business operation TypeScript block missing")
    typescript, hash_replacements = CATALOG_HASH_PATTERN.subn(
        rf'\g<1>{catalog_hash}\g<2>',
        source,
        count=1,
    )
    if hash_replacements != 1:
        raise SystemExit("catalog hash marker missing")

    args.catalog_output.parent.mkdir(parents=True, exist_ok=True)
    args.catalog_output.write_bytes(catalog_payload)
    args.lock_output.parent.mkdir(parents=True, exist_ok=True)
    args.lock_output.write_bytes(encode(lock))
    args.typescript_output.parent.mkdir(parents=True, exist_ok=True)
    args.typescript_output.write_text(typescript, encoding="utf-8")
    print(json.dumps({
        "catalogSha256": catalog_hash,
        "operationCount": 57,
        "transportOperationCount": 3,
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
