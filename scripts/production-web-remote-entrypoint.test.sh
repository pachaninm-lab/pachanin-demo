#!/usr/bin/env bash
set -Eeuo pipefail

source <(sed -n '/^reclaim_web_pull_space() {/,/^}/p' scripts/production-web-remote-entrypoint.sh)
fail() { printf 'FAIL=%s\n' "$*" >&2; exit 1; }
trim() { printf '%s' "$1"; }
TARGET_SHA=18e02668f84f7f88842779a9097f145504b105bb
FAKE_RUNNING_REF="pc-crop-transfer/web:$TARGET_SHA"
FAKE_REVISION="$TARGET_SHA"
FAKE_IDS=one
TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT
prod_dir="$TEST_DIR"
prod_project=grainflow
resolved_files=(compose.yml)
FAKE_COMPOSE_ID=abcdef012345
FAKE_PROJECT=grainflow
FAKE_WORKDIR="$TEST_DIR"

docker() {
  case "$*" in
    *'compose --project-directory '*' ps --status running -q web') printf '%s\n' "$FAKE_COMPOSE_ID" ;;
    *'compose --project-directory '*' config --format json') printf '{"name":"grainflow"}\n' ;;
    'ps -q --no-trunc --filter label=com.docker.compose.service=web')
      case "$FAKE_IDS" in one) echo abcdef012345 ;; two) printf 'abcdef012345\nfedcba987654\n' ;; esac ;;
    'ps -q --no-trunc') : ;;
    *"com.docker.compose.project.working_dir"*) printf '%s\n' "$FAKE_WORKDIR" ;;
    *"com.docker.compose.project"*) printf '%s\n' "$FAKE_PROJECT" ;;
    *"{{.Config.Image}}"*) printf '%s\n' "$FAKE_RUNNING_REF" ;;
    *"{{.Image}}"*) echo sha256:aabbcc ;;
    *"org.opencontainers.image.revision"*) printf '%s\n' "$FAKE_REVISION" ;;
    "info --format {{.DockerRootDir}}") printf '%s\n' "$TEST_DIR" ;;
    'image prune -f'|'builder prune -f') echo PRUNED ;;
    'image ls ghcr.io/pachaninm-lab/grainflow-web --no-trunc --format {{.Repository}}:{{.Tag}} {{.ID}}') : ;;
    *) printf 'unexpected docker call: %s\n' "$*" >&2; return 1 ;;
  esac
}

reclaim_web_pull_space >"$TEST_DIR/good.log"
grep -Fq "DOCKER_RECLAIM_CURRENT_WEB_IMAGE=pc-crop-transfer/web:$TARGET_SHA" "$TEST_DIR/good.log"

FAKE_REVISION=0000000000000000000000000000000000000000
if (reclaim_web_pull_space) >"$TEST_DIR/mismatch.log" 2>&1; then exit 1; fi
grep -Fq 'running web transfer tag does not match OCI revision' "$TEST_DIR/mismatch.log"
if grep -Fq 'PRUNED' "$TEST_DIR/mismatch.log"; then exit 1; fi

FAKE_REVISION="$TARGET_SHA"
FAKE_COMPOSE_ID=fedcba987654
if (reclaim_web_pull_space) >"$TEST_DIR/wrong-project-service.log" 2>&1; then exit 1; fi
grep -Fq 'outside resolved production Compose authority' "$TEST_DIR/wrong-project-service.log"
if grep -Fq 'PRUNED' "$TEST_DIR/wrong-project-service.log"; then exit 1; fi

FAKE_COMPOSE_ID=abcdef012345
FAKE_PROJECT=wrong-project
if (reclaim_web_pull_space) >"$TEST_DIR/wrong-project-label.log" 2>&1; then exit 1; fi
grep -Fq 'project label differs' "$TEST_DIR/wrong-project-label.log"
if grep -Fq 'PRUNED' "$TEST_DIR/wrong-project-label.log"; then exit 1; fi

FAKE_PROJECT=grainflow
FAKE_WORKDIR=/
if (reclaim_web_pull_space) >"$TEST_DIR/wrong-directory.log" 2>&1; then exit 1; fi
grep -Fq 'working directory differs' "$TEST_DIR/wrong-directory.log"
if grep -Fq 'PRUNED' "$TEST_DIR/wrong-directory.log"; then exit 1; fi

FAKE_WORKDIR="$TEST_DIR"
FAKE_IDS=two
if (reclaim_web_pull_space) >"$TEST_DIR/ambiguous.log" 2>&1; then exit 1; fi
grep -Fq 'requires exactly one production Compose web service' "$TEST_DIR/ambiguous.log"
if grep -Fq 'PRUNED' "$TEST_DIR/ambiguous.log"; then exit 1; fi

printf 'PASS: full-stack web authority and fail-closed release preflight\n'
