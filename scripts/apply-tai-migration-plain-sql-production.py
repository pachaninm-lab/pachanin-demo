#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement target, found {count}: {old[:180]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def insert_before(path: Path, anchor: str, insertion: str) -> None:
    text = path.read_text(encoding="utf-8")
    if insertion in text:
        return
    count = text.count(anchor)
    if count != 1:
        raise SystemExit(f"{path}: expected one insertion anchor, found {count}: {anchor[:180]!r}")
    path.write_text(text.replace(anchor, insertion + anchor, 1), encoding="utf-8")


deploy = Path("scripts/tai-reg-ru-deploy.sh")
checker = Path("scripts/check-tai-reg-ru-deploy.mjs")

insert_before(
    deploy,
    '  docker run --rm --read-only --network none --entrypoint python "$TAI_IMAGE_DIGEST" - > "$MIGRATION_BUNDLE" <<\'PY_MIGRATIONS\'\n',
    '  set_internal_deploy_stage TAI_DEPLOY_MIGRATION_BUNDLE_EXTRACTION_FAILED\n',
)
insert_before(
    deploy,
    '  python3 - "$MIGRATION_BUNDLE" "$MIGRATION_SQL" "$TARGET_SHA" <<\'PY_MIGRATION_SQL\'\n',
    '  set_internal_deploy_stage TAI_DEPLOY_MIGRATION_SQL_GENERATION_FAILED\n',
)

replace_once(
    deploy,
    """    match=re.fullmatch(r'\\s*BEGIN;\\s*(.*?)\\s*COMMIT;\\s*',raw,re.S|re.I)
    if not match: raise SystemExit(f'migration transaction boundary invalid: {path}')
    body=match.group(1).strip(); prefix=f'tai_m{version}_'
""",
    """    wrapped=re.fullmatch(r'\\s*BEGIN\\s*;\\s*(.*?)\\s*COMMIT\\s*;\\s*',raw,re.S|re.I)
    leading=bool(re.match(r'\\s*BEGIN\\s*;',raw,re.I))
    trailing=bool(re.search(r'COMMIT\\s*;\\s*$',raw,re.I))
    if leading != trailing: raise SystemExit(f'unbalanced outer migration transaction boundary: {path}')
    body=(wrapped.group(1) if wrapped else raw).strip()
    if not body: raise SystemExit(f'empty migration body: {path}')
    prefix=f'tai_m{version}_'
""",
)

insert_before(
    deploy,
    '  psql_admin -f "$MIGRATION_SQL"\n',
    '  set_internal_deploy_stage TAI_DEPLOY_MIGRATION_APPLICATION_FAILED\n',
)
insert_before(
    deploy,
    '  expected_count="$(python3 - "$MIGRATION_BUNDLE" <<\'PY_COUNT\'\n',
    '  set_internal_deploy_stage TAI_DEPLOY_MIGRATION_LEDGER_VERIFICATION_FAILED\n',
)

replace_once(
    checker,
    "import { readFileSync } from 'node:fs';\n",
    "import { readFileSync } from 'node:fs';\nimport './check-tai-migration-sql-normalization.mjs';\n",
)

for marker in [
    "TAI_DEPLOY_MIGRATION_BUNDLE_EXTRACTION_FAILED",
    "TAI_DEPLOY_MIGRATION_SQL_GENERATION_FAILED",
    "TAI_DEPLOY_MIGRATION_APPLICATION_FAILED",
    "TAI_DEPLOY_MIGRATION_LEDGER_VERIFICATION_FAILED",
    "unbalanced outer migration transaction boundary",
    "empty migration body",
]:
    insert_before(
        checker,
        "  'TAI_IMAGE_DIGEST',\n",
        f"  '{marker}',\n",
    )

print("TAI_MIGRATION_PLAIN_SQL_PRODUCTION_PATCH=APPLIED")
