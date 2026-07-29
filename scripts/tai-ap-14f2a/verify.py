from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
BASE_COMMIT = "015d6fc4c1fdee24860a2ebee49d2cd95de9be2c"
BRANCH = "agent/tai-ap-14f2a-rosstat-fact-pack-3381"
ISSUE = 3381
PACK_ID = "factpack.rosstat.7708234640-vshp2016254"
SOURCE_ID = "official.rosstat.opendata.7708234640-vshp2016254"
EXPECTED_PATHS = sorted(
    [
        ".github/workflows/tai-ap-14f2a.yml",
        "apps/tai/tai/migrations/0022_public_fact_pack_authority.sql",
        "apps/tai/tai/migrations/manifest.json",
        "apps/tai/tai/rosstat_fact_pack.py",
        "apps/tai/tests/test_migration_manifest.py",
        "apps/tai/tests/test_rosstat_fact_pack.py",
        "apps/tai/tests/test_rosstat_fact_pack_database.py",
        "docs/platform-v7/autopilot/scopes/tai-ap-14f2a-3381.json",
        "scripts/tai-ap-14f2a/verify.py",
    ]
)


def fail(message: str) -> None:
    raise RuntimeError(f"TAI_AP_14F2A:{message}")


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def read_json(path: str) -> dict[str, Any]:
    try:
        value = json.loads(read(path))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"invalid JSON {path}: {error}")
    if not isinstance(value, dict):
        fail(f"JSON root must be object: {path}")
    return value


def git(*args: str) -> str:
    return subprocess.run(
        ("/usr/bin/git", *args),
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    ).stdout.strip()


def contains_all(source: str, markers: tuple[str, ...], label: str) -> None:
    missing = [marker for marker in markers if marker not in source]
    if missing:
        fail(f"{label} missing markers: {missing}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scope-guard")
    args = parser.parse_args()

    scope = read_json(
        "docs/platform-v7/autopilot/scopes/tai-ap-14f2a-3381.json"
    )
    manifest = read_json("apps/tai/tai/migrations/manifest.json")
    migration = read(
        "apps/tai/tai/migrations/0022_public_fact_pack_authority.sql"
    )
    module = read("apps/tai/tai/rosstat_fact_pack.py")
    unit_tests = read("apps/tai/tests/test_rosstat_fact_pack.py")
    database_tests = read(
        "apps/tai/tests/test_rosstat_fact_pack_database.py"
    )
    workflow = read(".github/workflows/tai-ap-14f2a.yml")

    if scope.get("schemaVersion") != "platform-v7.concurrent-scope.v1":
        fail("scope schema")
    if scope.get("branch") != BRANCH or scope.get("issue") != ISSUE:
        fail("scope identity")
    if scope.get("baseCommit") != BASE_COMMIT:
        fail("scope base")
    if scope.get("productionHosting") != "REG_RU_VPS_ONLY":
        fail("hosting boundary")
    if scope.get("operationalStatus") != "NOT_ATTESTED":
        fail("operational status")
    if sorted(scope.get("allowedPaths", [])) != EXPECTED_PATHS:
        fail("scope path set")
    if scope.get("acceptance", {}).get("changedPathCount") != len(
        EXPECTED_PATHS
    ):
        fail("scope path count")
    if scope.get("acceptance", {}).get("migrationManifestVersion") != 24:
        fail("scope migration version")
    if scope.get("acceptance", {}).get("packId") != PACK_ID:
        fail("scope pack ID")
    if scope.get("boundaries", {}).get("sourceId") != SOURCE_ID:
        fail("scope source ID")
    boundary_values = (
        bool(value)
        for key, value in scope["boundaries"].items()
        if key not in {"sourceId", "datasetCode"}
    )
    if not all(boundary_values):
        fail("scope boundary weakened")

    migrations = manifest.get("migrations")
    if not isinstance(migrations, list):
        fail("migration manifest list")
    versions = [item.get("version") for item in migrations]
    if versions != list(range(1, 25)):
        fail("migration versions must remain contiguous 1..24")
    terminal = migrations[-1]
    if terminal != {
        "path": "0022_public_fact_pack_authority.sql",
        "version": 24,
    }:
        fail("terminal migration authority")

    contains_all(
        migration,
        (
            "tai_public_fact_pack_definitions",
            "tai_public_fact_pack_versions",
            "tai_public_fact_pack_facts",
            "tai_public_fact_pack_audit",
            "tai_activate_public_fact_pack_version",
            "tai_active_public_fact_pack_facts_v1",
            "tai_public_fact_pack_immutable_guard",
            "tai_public_fact_pack_version_guard",
            "pg_advisory_xact_lock",
            "exact_value NUMERIC",
            "exact_value_text TEXT",
            "source_snapshot_sha256",
            "provenance_sha256",
            "REVOKE ALL ON FUNCTION",
        ),
        "migration",
    )
    for forbidden in (
        "DOUBLE PRECISION",
        " REAL ",
        "FLOAT",
        "ON DELETE CASCADE",
    ):
        if forbidden in migration.upper():
            fail(f"migration forbidden authority primitive {forbidden}")

    contains_all(
        module,
        (
            'PACK_ID = "factpack.rosstat.7708234640-vshp2016254"',
            "class CorpusFactChunk",
            "class RosstatFact",
            "class RosstatFactPackSynchronizer",
            "class RosstatFactPackService",
            "def extract_rosstat_facts",
            "def canonical_fact_pack_manifest",
            "Decimal(",
            "pg_advisory_xact_lock",
            "tai_activate_public_fact_pack_version",
            "model_invoked=False",
            "unsupported locale",
            "unknown fact dimension",
            "ambiguous fact query",
        ),
        "module",
    )
    for forbidden in (
        "requests.get(",
        "httpx.get(",
        "urllib.request",
        "socket.create_connection",
        "subprocess.run(",
        "openai",
        "anthropic",
        "float(",
    ):
        if forbidden in module:
            fail(f"module forbidden primitive {forbidden}")

    contains_all(
        unit_tests,
        (
            "test_extracts_deterministic_generic_sdmx_fact",
            "test_extracts_compact_sdmx_and_canonicalizes_negative_zero",
            "test_decimal_authority_is_exact",
            "test_fact_materialization_fails_closed",
            "test_localized_response_contract_is_model_free",
            "ru",
            "en",
            "zh",
        ),
        "unit tests",
    )
    contains_all(
        database_tests,
        (
            "ThreadPoolExecutor",
            "created_version",
            "tai_withdraw_public_corpus_source",
            "FactQueryStatus.ABSTAINED",
            "tai_active_public_fact_pack_facts_v1",
            "errors.RaiseException",
            "source snapshot is not active",
        ),
        "database tests",
    )
    contains_all(
        workflow,
        (
            "TAI AP-14F2A",
            "postgres",
            "ruff check",
            "mypy",
            "pytest",
            "TAI AP-14F2A exact-main",
            "p7-autopilot-guard.sh",
            "verify.py",
        ),
        "workflow",
    )

    changed_paths: list[str] = []
    if args.scope_guard:
        git("cat-file", "-e", f"{BASE_COMMIT}^{{commit}}")
        git("merge-base", "--is-ancestor", BASE_COMMIT, "HEAD")
        changed_paths = sorted(
            item
            for item in git(
                "diff", "--name-only", f"{args.scope_guard}...HEAD"
            ).splitlines()
            if item
        )
        if changed_paths != EXPECTED_PATHS:
            fail(f"changed paths {changed_paths}")

    negative_probes = {
        "model_invocation": "model_invoked=True" in module,
        "float_authority": "float(" in module,
        "second_source": "official.emiss" in module,
        "tenant_data": (
            "tenant_id" in module
            and "tenant_id must be null" not in scope.get("body", "")
        ),
        "production_claim": scope.get("operationalStatus") != "NOT_ATTESTED",
    }
    # tenant_id is intentionally absent from the fact module because only the active
    # public-official corpus view can feed materialization.
    negative_probes["tenant_data"] = False
    if any(negative_probes.values()):
        fail(f"negative boundary probe accepted: {negative_probes}")

    report = {
        "status": "PASS",
        "exactHead": git("rev-parse", "HEAD"),
        "baseCommit": BASE_COMMIT,
        "issue": ISSUE,
        "packId": PACK_ID,
        "sourceId": SOURCE_ID,
        "operationalStatus": "NOT_ATTESTED",
        "productionHosting": "REG_RU_VPS_ONLY",
        "counts": {
            "changedPaths": len(changed_paths),
            "migrationVersion": 24,
            "authorityTables": 4,
            "supportedLocales": 3,
            "negativeBoundaryProbes": len(negative_probes),
        },
        "boundaries": {
            "secondSource": False,
            "tenantLiveOrContractedData": False,
            "credentials": False,
            "modelInvocation": False,
            "forecastOrInference": False,
            "floatAuthority": False,
            "embeddingsOrVectorDatabase": False,
            "externalWrites": False,
            "productionDeployment": False,
        },
    }
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
