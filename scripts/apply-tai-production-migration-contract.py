#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one target, found {count}: {old!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


workflow = Path(".github/workflows/tai-reg-ru-deploy.yml")
replace_once(
    workflow,
    '      - "scripts/check-tai-reg-ru-deploy.mjs"\n',
    '      - "scripts/check-tai-reg-ru-deploy.mjs"\n      - "scripts/check-tai-production-migrations.sh"\n      - "apps/tai/tai/migrations/**"\n',
)
replace_once(
    workflow,
    '          node scripts/check-tai-reg-ru-deploy.mjs\n',
    '          node scripts/check-tai-reg-ru-deploy.mjs\n          bash scripts/check-tai-production-migrations.sh\n',
)
print("TAI_PRODUCTION_MIGRATION_CONTRACT_PATCH=APPLIED")
