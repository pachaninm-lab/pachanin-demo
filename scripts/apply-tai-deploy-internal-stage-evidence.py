#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement target, found {count}: {old[:120]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def insert_before(path: Path, anchor: str, insertion: str) -> None:
    text = path.read_text(encoding="utf-8")
    if insertion in text:
        return
    count = text.count(anchor)
    if count != 1:
        raise SystemExit(f"{path}: expected one insertion anchor, found {count}: {anchor[:120]!r}")
    path.write_text(text.replace(anchor, insertion + anchor, 1), encoding="utf-8")


deploy = Path("scripts/tai-reg-ru-deploy.sh")
checker = Path("scripts/check-tai-reg-ru-deploy.mjs")

replace_once(
    deploy,
    "STATE_ROOT_CREATED_THIS_ATTEMPT=0\n\n",
    """STATE_ROOT_CREATED_THIS_ATTEMPT=0
DEPLOY_STAGE_FILE="${MODEL_EVIDENCE_FILE%/*}/deploy-stage-error.log"
[[ "$DEPLOY_STAGE_FILE" == "/var/lib/pc-release-authority/controller-jobs/$RUN_ID/deploy-stage-error.log" ]] || {
  printf 'ERROR_CODE=TAI_DEPLOY_STAGE_PATH_INVALID\\n' >&2
  exit 15
}

set_internal_deploy_stage() {
  local code="$1"
  [[ "$code" =~ ^[A-Z][A-Z0-9]*_[A-Z0-9_]+$ ]] || {
    printf 'ERROR_CODE=TAI_DEPLOY_STAGE_CODE_INVALID\\n' >&2
    exit 16
  }
  printf 'ERROR_CODE=%s\\n' "$code" > "$DEPLOY_STAGE_FILE"
  chmod 0600 "$DEPLOY_STAGE_FILE"
}

""",
)

stages = [
    (
        "mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')\n",
        "set_internal_deploy_stage TAI_DEPLOY_WEB_CONTAINER_DISCOVERY_FAILED\n",
    ),
    (
        "mapfile -t compose_files < <(docker inspect --format",
        "set_internal_deploy_stage TAI_DEPLOY_COMPOSE_FILE_DISCOVERY_FAILED\n",
    ),
    (
        "COMPOSE_JSON=\"$(mktemp)\"\n",
        "set_internal_deploy_stage TAI_DEPLOY_COMPOSE_RENDER_FAILED\n",
    ),
    (
        "mapfile -t project_container_ids < <(docker ps -aq --filter \"label=com.docker.compose.project=$prod_project\")\n",
        "set_internal_deploy_stage TAI_DEPLOY_PROJECT_CONTAINER_INSPECTION_FAILED\n",
    ),
    (
        "TOPOLOGY_ENV=\"$(mktemp)\"\n",
        "set_internal_deploy_stage TAI_DEPLOY_POSTGRES_AUTHORITY_RESOLUTION_FAILED\n",
    ),
    (
        "source \"$TOPOLOGY_ENV\"\n",
        "set_internal_deploy_stage TAI_DEPLOY_TOPOLOGY_ENV_IMPORT_FAILED\n",
    ),
    (
        "mapfile -t previous_tai < <(docker ps -aq --filter \"label=com.docker.compose.project=$prod_project\" --filter 'label=com.docker.compose.service=tai')\n",
        "set_internal_deploy_stage TAI_DEPLOY_PREVIOUS_TAI_AUTHORITY_FAILED\n",
    ),
    (
        "web_id=\"$(DC_BASE ps -q web | head -1)\"\n",
        "set_internal_deploy_stage TAI_DEPLOY_EXACT_MAIN_RUNTIME_ASSERTION_FAILED\n",
    ),
    (
        "mkdir -- \"$STATE_ROOT\" || { echo \"STATE_ROOT_ALREADY_EXISTS_OR_UNAVAILABLE\" >&2; exit 30; }\n",
        "set_internal_deploy_stage TAI_DEPLOY_STATE_AUTHORITY_PREPARATION_FAILED\n",
    ),
    (
        "apply_tai_migrations\n",
        "set_internal_deploy_stage TAI_DEPLOY_MIGRATIONS_FAILED\n",
    ),
    (
        "build_bootstrap_authority\n",
        "set_internal_deploy_stage TAI_DEPLOY_BOOTSTRAP_AUTHORITY_BUILD_FAILED\n",
    ),
    (
        "apply_bootstrap_authority\n",
        "set_internal_deploy_stage TAI_DEPLOY_BOOTSTRAP_AUTHORITY_APPLY_FAILED\n",
    ),
    (
        "authority_row=\"$(\n",
        "set_internal_deploy_stage TAI_DEPLOY_BOOTSTRAP_VERIFICATION_FAILED\n",
    ),
    (
        "role_exists=\"$(\n",
        "set_internal_deploy_stage TAI_DEPLOY_RUNTIME_ROLE_BOUNDARY_FAILED\n",
    ),
    (
        "model_token=\"$(cat \"$MODEL_TOKEN_FILE\")\"\n",
        "set_internal_deploy_stage TAI_DEPLOY_RUNTIME_SECRET_PREPARATION_FAILED\n",
    ),
    (
        "backup_file \"$ENV_FILE\"\n",
        "set_internal_deploy_stage TAI_DEPLOY_RUNTIME_CONFIGURATION_FAILED\n",
    ),
    (
        "MUTATION_STARTED=1\n",
        "set_internal_deploy_stage TAI_DEPLOY_RUNTIME_MATERIALIZATION_FAILED\n",
    ),
    (
        "if [[ \"$role_exists\" == 0 ]]; then\n",
        "set_internal_deploy_stage TAI_DEPLOY_DATABASE_ROLE_MATERIALIZATION_FAILED\n",
    ),
    (
        "cat > \"$ENV_FILE\" <<ENV\n",
        "set_internal_deploy_stage TAI_DEPLOY_ENVIRONMENT_MATERIALIZATION_FAILED\n",
    ),
    (
        "cat > \"$OVERRIDE\" <<YAML\n",
        "set_internal_deploy_stage TAI_DEPLOY_OVERRIDE_MATERIALIZATION_FAILED\n",
    ),
    (
        "DC_TAI config >/dev/null\n",
        "set_internal_deploy_stage TAI_DEPLOY_COMPOSE_VALIDATION_FAILED\n",
    ),
    (
        "docker pull \"$TAI_IMAGE_DIGEST\" >/dev/null\n",
        "set_internal_deploy_stage TAI_DEPLOY_IMAGE_MATERIALIZATION_FAILED\n",
    ),
    (
        "DC_TAI up -d --no-deps --force-recreate tai\n",
        "set_internal_deploy_stage TAI_DEPLOY_CONTAINER_MATERIALIZATION_FAILED\n",
    ),
    (
        "for attempt in $(seq 1 90); do\n",
        "set_internal_deploy_stage TAI_DEPLOY_RUNTIME_HEALTHCHECK_FAILED\n",
    ),
    (
        "python3 - \"$EVIDENCE\" \"$TARGET_SHA\" \"$RUN_ID\" \"$TAI_IMAGE\" \"$TAI_IMAGE_DIGEST\" \"$container_id\" \"$container_revision\" \"$container_image_id\" \"$active_generation_id\" \"$active_model_profile_id\" \"$model_artifact_sha256\" \"$model_artifact_size\" \"$model_max_context\" <<'PY_EVIDENCE'\n",
        "set_internal_deploy_stage TAI_DEPLOY_EVIDENCE_GENERATION_FAILED\n",
    ),
]
for anchor, insertion in stages:
    insert_before(deploy, anchor, insertion)

replace_once(
    checker,
    "  'TAI_IMAGE_DIGEST',\n",
    """  'TAI_IMAGE_DIGEST',
  'set_internal_deploy_stage',
  'deploy-stage-error.log',
  'TAI_DEPLOY_COMPOSE_RENDER_FAILED',
  'TAI_DEPLOY_MIGRATIONS_FAILED',
  'TAI_DEPLOY_BOOTSTRAP_AUTHORITY_BUILD_FAILED',
  'TAI_DEPLOY_BOOTSTRAP_AUTHORITY_APPLY_FAILED',
  'TAI_DEPLOY_BOOTSTRAP_VERIFICATION_FAILED',
  'TAI_DEPLOY_RUNTIME_ROLE_BOUNDARY_FAILED',
  'TAI_DEPLOY_COMPOSE_VALIDATION_FAILED',
  'TAI_DEPLOY_RUNTIME_HEALTHCHECK_FAILED',
""",
)

print("TAI_DEPLOY_INTERNAL_STAGE_EVIDENCE_PATCH=APPLIED")
