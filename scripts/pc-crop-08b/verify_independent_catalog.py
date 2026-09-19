#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from catalog_constants import (
    CatalogError,
    EXPECTED_PACKAGE_SHA,
    EXPECTED_SOURCE_INVENTORY_SHA,
    EXPECTED_SOURCE_SCHEMA_MANIFEST_SHA,
)
from catalog_generate import derive_catalog
from catalog_xml import canonical_json, read_source_lock, sha256_bytes

EXPECTED_INDEPENDENT_CATALOG_SHA = "cf9fae0597c3672426e84896ef1e73fb640f8132faa34cb91ff8e884b0ae9151"


def primary_operations(catalog: dict) -> dict[str, dict[str, str]]:
    fields = catalog["business"]["operationFields"]
    indexes = {field: index for index, field in enumerate(fields)}
    family_fields = catalog["business"]["familyFields"]
    family_indexes = {field: index for index, field in enumerate(family_fields)}
    namespaces = {
        row[family_indexes["code"]]: row[family_indexes["namespace"]]
        for row in catalog["business"]["families"]
    }
    result: dict[str, dict[str, str]] = {}
    for row in catalog["business"]["operations"]:
        code = row[indexes["code"]]
        family = row[indexes["family"]]
        namespace = namespaces[family]
        if code in result:
            raise CatalogError(f"duplicate primary operation code: {code}")
        result[code] = {
            "family": family,
            "classification": row[indexes["classification"]],
            "requestQName": f"{{{namespace}}}{row[indexes['requestLocalName']]}",
            "responseQName": f"{{{namespace}}}{row[indexes['responseLocalName']]}",
        }
    return result


def primary_transport(catalog: dict) -> dict[str, dict[str, str]]:
    fields = catalog["transport"]["fields"]
    indexes = {field: index for index, field in enumerate(fields)}
    result: dict[str, dict[str, str]] = {}
    for row in catalog["transport"]["operations"]:
        name = row[indexes["name"]]
        result[name] = {
            "soapAction": row[indexes["soapAction"]],
            "inputQName": row[indexes["inputQName"]],
            "outputQName": row[indexes["outputQName"]],
            "faultQName": row[indexes["faultQName"]],
        }
    return result


def verify(archive_path: Path, source_lock_path: Path, primary_path: Path) -> dict:
    lock = read_source_lock(source_lock_path)
    archive = archive_path.read_bytes()
    if sha256_bytes(archive) != EXPECTED_PACKAGE_SHA:
        raise CatalogError("official package SHA mismatch")
    if lock["inventorySha256"] != EXPECTED_SOURCE_INVENTORY_SHA:
        raise CatalogError("source inventory SHA mismatch")
    if lock["schemaManifestSha256"] != EXPECTED_SOURCE_SCHEMA_MANIFEST_SHA:
        raise CatalogError("source schema manifest SHA mismatch")
    independent = derive_catalog(archive)
    independent_hash = sha256_bytes(canonical_json(independent))
    if independent_hash != EXPECTED_INDEPENDENT_CATALOG_SHA:
        raise CatalogError(f"independent catalog hash drift: {independent_hash}")
    primary = json.loads(primary_path.read_text("utf-8"))
    if primary.get("schemaVersion") != "pc-crop.fgis-grain-operation-catalog.v1":
        raise CatalogError("primary catalog schema mismatch")

    expected_operations = {
        row["code"]: {
            "family": row["family"],
            "classification": "READ" if row["kind"] == "READ" else "MUTATION",
            "requestQName": row["requestQName"],
            "responseQName": row["responseQName"],
        }
        for row in independent["operations"]
    }
    actual_operations = primary_operations(primary)
    if actual_operations != expected_operations:
        missing = sorted(set(expected_operations) - set(actual_operations))
        extra = sorted(set(actual_operations) - set(expected_operations))
        mismatched = sorted(
            code
            for code in set(expected_operations) & set(actual_operations)
            if expected_operations[code] != actual_operations[code]
        )
        raise CatalogError(
            f"primary/independent business catalog mismatch: missing={missing}, extra={extra}, mismatched={mismatched}"
        )

    expected_transport = {
        row["operation"]: {
            "soapAction": row["soapAction"],
            "inputQName": row["requestElementQName"],
            "outputQName": row["responseElementQName"],
            "faultQName": row["faultElementQName"],
        }
        for row in independent["wsdl"]["transportOperations"]
    }
    actual_transport = primary_transport(primary)
    if actual_transport != expected_transport:
        raise CatalogError("primary/independent transport catalog mismatch")

    return {
        "schemaVersion": "pc-crop.fgis-grain-differential-verification.v1",
        "status": "PASS",
        "apiVersion": "1.0.23",
        "packageSha256": EXPECTED_PACKAGE_SHA,
        "independentCatalogSha256": independent_hash,
        "businessOperationCount": len(actual_operations),
        "familyCount": len(independent["families"]),
        "transportOperationCount": len(actual_transport),
        "protocolEvidence": {
            "synchronousCalls": independent["protocol"]["synchronousCalls"],
            "asynchronousProcessingQueue": independent["protocol"]["asynchronousProcessingQueue"],
            "ackIrreversiblyRemovesResponse": independent["protocol"]["ackMeaning"]
            == "CONFIRM_AND_IRREVERSIBLY_REMOVE_RESPONSE",
            "officialDocumentSha256": independent["protocol"]["sha256"],
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--source-lock", required=True, type=Path)
    parser.add_argument("--primary-catalog", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        report = verify(args.archive, args.source_lock, args.primary_catalog)
    except (CatalogError, OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"PC-CROP-08B differential verification failed: {error}") from error
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2) + "\n", "utf-8")
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
