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


deploy = Path("scripts/tai-reg-ru-deploy.sh")
checker = Path("scripts/check-tai-reg-ru-deploy.mjs")

replace_once(
    deploy,
    '''psql_admin() {
  docker exec -i "$DB_ID" psql -X --set ON_ERROR_STOP=1 -U "$DB_ADMIN" -d "$DB_NAME" "$@"
}
''',
    '''psql_admin() {
  docker exec -i "$DB_ID" psql -X --set ON_ERROR_STOP=1 -U "$DB_ADMIN" -d "$DB_NAME" "$@"
}

psql_admin_file() {
  local path="$1" authority
  case "$path" in
    "$MIGRATION_SQL") authority='migration' ;;
    "$BOOTSTRAP_SQL") authority='bootstrap' ;;
    *) echo "TAI_SQL_INPUT_AUTHORITY_INVALID" >&2; return 24 ;;
  esac
  [[ -f "$path" && ! -L "$path" ]] || { echo "TAI_SQL_INPUT_FILE_INVALID_${authority^^}" >&2; return 25; }
  [[ "$(stat -c '%U:%G:%a' "$path")" == root:root:600 ]] || {
    echo "TAI_SQL_INPUT_PERMISSIONS_INVALID_${authority^^}" >&2
    return 26
  }
  docker exec -i "$DB_ID" psql -X --set ON_ERROR_STOP=1 -U "$DB_ADMIN" -d "$DB_NAME" < "$path"
}
''',
)
replace_once(deploy, '  psql_admin -f "$MIGRATION_SQL"\n', '  psql_admin_file "$MIGRATION_SQL"\n')
replace_once(deploy, '  psql_admin -f "$BOOTSTRAP_SQL"\n', '  psql_admin_file "$BOOTSTRAP_SQL"\n')

replace_once(
    checker,
    "  'TAI_IMAGE_DIGEST',\n",
    """  'TAI_IMAGE_DIGEST',
  'psql_admin_file()',
  'psql_admin_file \"$MIGRATION_SQL\"',
  'psql_admin_file \"$BOOTSTRAP_SQL\"',
  'docker exec -i \"$DB_ID\" psql -X --set ON_ERROR_STOP=1 -U \"$DB_ADMIN\" -d \"$DB_NAME\" < \"$path\"',
  'TAI_SQL_INPUT_AUTHORITY_INVALID',
  'TAI_SQL_INPUT_PERMISSIONS_INVALID_',
""",
)
replace_once(
    checker,
    "forbid(deploy, /INSERT\\s+INTO\\s+(?:public[.])?tai_model_admission_decisions/iu, deployPath + ': fabricated permanent model admission is forbidden');\n",
    """forbid(deploy, /INSERT\\s+INTO\\s+(?:public[.])?tai_model_admission_decisions/iu, deployPath + ': fabricated permanent model admission is forbidden');
forbid(
  deploy,
  /psql_admin\\s+-f\\s+[\"']\\$(?:MIGRATION|BOOTSTRAP)_SQL[\"']/u,
  deployPath + ': a host SQL path may not be passed to psql inside the database container',
);
""",
)
print("TAI_HOST_SQL_STREAM_PATCH=APPLIED")
