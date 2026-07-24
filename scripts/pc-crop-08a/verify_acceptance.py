#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import urllib.parse
from pathlib import Path
from typing import Any


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-lock", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    args = parser.parse_args()

    source_lock = json.loads(args.source_lock.read_text("utf-8"))
    summary = json.loads((args.evidence / "intake-summary.json").read_text("utf-8"))
    inventory = json.loads((args.evidence / "inventory.json").read_text("utf-8"))
    schema_manifest = json.loads(
        (args.evidence / "schema-manifest.json").read_text("utf-8")
    )

    archive_path = args.evidence / source_lock["expectedFilename"]
    exact_head = os.environ.get("EXACT_HEAD", "")

    final_host = (
        urllib.parse.urlparse(summary.get("finalArtifactUrl") or "").hostname or ""
    ).lower()
    checks = {
        "exactHeadPresent": len(exact_head) == 40,
        "versionExact": source_lock.get("version") == "1.0.23"
        and summary.get("version") == "1.0.23"
        and inventory.get("version") == "1.0.23"
        and schema_manifest.get("version") == "1.0.23",
        "sourceLockPinned": source_lock.get("status") == "PINNED",
        "officialSourcePageExact": summary.get("sourcePageUrl")
        == source_lock.get("sourcePageUrl"),
        "officialArtifactHostAllowlisted": final_host
        in {
            host.lower()
            for host in source_lock.get("allowedArtifactHosts", [])
        },
        "finalArtifactUrlPinned": bool(source_lock.get("finalArtifactUrl"))
        and summary.get("finalArtifactUrl") == source_lock.get("finalArtifactUrl"),
        "archivePresent": archive_path.is_file(),
        "packageHashPinned": bool(source_lock.get("packageSha256"))
        and archive_path.is_file()
        and sha256_file(archive_path) == source_lock.get("packageSha256")
        and summary.get("packageSha256") == source_lock.get("packageSha256")
        and inventory.get("packageSha256") == source_lock.get("packageSha256")
        and schema_manifest.get("packageSha256") == source_lock.get("packageSha256"),
        "artifactSizePinned": isinstance(source_lock.get("artifactSizeBytes"), int)
        and summary.get("artifactSizeBytes") == source_lock.get("artifactSizeBytes"),
        "inventoryHashPinned": bool(source_lock.get("inventorySha256"))
        and sha256_file(args.evidence / "inventory.json")
        == source_lock.get("inventorySha256")
        and summary.get("inventorySha256") == source_lock.get("inventorySha256"),
        "schemaManifestHashPinned": bool(source_lock.get("schemaManifestSha256"))
        and sha256_file(args.evidence / "schema-manifest.json")
        == source_lock.get("schemaManifestSha256")
        and summary.get("schemaManifestSha256")
        == source_lock.get("schemaManifestSha256"),
        "nonEmptyInventory": summary.get("fileCount", 0) > 0
        and summary.get("entryCount", 0) >= summary.get("fileCount", 0),
        "nonEmptySchemaAuthority": summary.get("schemaCount", 0) > 0
        and len(schema_manifest.get("files", [])) == summary.get("schemaCount"),
        "allSchemaReferencesResolved": summary.get("unresolvedReferenceCount") == 0
        and schema_manifest.get("unresolvedReferences") == [],
        "officialOperatorSourceOnly": source_lock.get("boundaries", {}).get(
            "officialOperatorSourceOnly"
        )
        is True,
        "noLiveConnectionClaim": source_lock.get("boundaries", {}).get(
            "liveConnection"
        )
        is False,
        "noCredentialsClaim": source_lock.get("boundaries", {}).get(
            "credentialsPresent"
        )
        is False,
        "noConfirmedLiveClaim": source_lock.get("boundaries", {}).get(
            "confirmedLive"
        )
        is False,
        "productionRemainsRegRuOnly": source_lock.get("productionHosting")
        == "REG_RU_VPS_ONLY",
    }

    failures = [name for name, passed in checks.items() if not passed]
    report = {
        "schemaVersion": "pc-crop.fgis-grain-artifact-acceptance.v1",
        "slice": "PC-CROP-08A",
        "issue": 3155,
        "status": "PASS" if not failures else "FAIL",
        "operationalStatus": "NOT_ATTESTED",
        "exactHead": exact_head,
        "version": "1.0.23",
        "sourcePageUrl": summary.get("sourcePageUrl"),
        "finalArtifactUrl": summary.get("finalArtifactUrl"),
        "packageSha256": summary.get("packageSha256"),
        "inventorySha256": summary.get("inventorySha256"),
        "schemaManifestSha256": summary.get("schemaManifestSha256"),
        "metrics": {
            "artifactSizeBytes": summary.get("artifactSizeBytes"),
            "entryCount": summary.get("entryCount"),
            "fileCount": summary.get("fileCount"),
            "totalUncompressedSizeBytes": summary.get(
                "totalUncompressedSizeBytes"
            ),
            "schemaCount": summary.get("schemaCount"),
            "unresolvedReferenceCount": summary.get(
                "unresolvedReferenceCount"
            ),
        },
        "checks": checks,
        "failures": failures,
        "boundaries": {
            "handwrittenEndpointOrFieldMapping": False,
            "liveCredentialOrCertificateUse": False,
            "externalProductionApiCall": False,
            "confirmedLiveClaim": False,
            "secondInboxOutboxOrRelay": False,
            "productionDeploymentEvidence": False,
        },
        "productionHosting": "REG_RU_VPS_ONLY",
    }
    write_json(args.evidence / "pc-crop-08a-acceptance.json", report)
    print(json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
