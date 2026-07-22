#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

EXACT_MAIN="${GITHUB_SHA:?GITHUB_SHA required}"
WORKFLOW_RUN_ID="${GITHUB_RUN_ID:?GITHUB_RUN_ID required}"
WORKFLOW_RUN_ATTEMPT="${GITHUB_RUN_ATTEMPT:?GITHUB_RUN_ATTEMPT required}"
MODEL_HOST="${TAI_MODEL_HOST:?TAI_MODEL_HOST required}"
MODEL_SSH_USER="${TAI_MODEL_SSH_USER:-tai-model}"
MODEL_SSH_PORT="${TAI_MODEL_SSH_PORT:-22}"
MODEL_SSH_KEY="${TAI_MODEL_SSH_KEY:?TAI_MODEL_SSH_KEY required}"
LOCAL_ROOT="qwen-preview-evidence"
CONTROL_ROOT="$LOCAL_ROOT/control"
REMOTE_ROOT="/srv/tai-models/preview-runs/$EXACT_MAIN/$WORKFLOW_RUN_ID-$WORKFLOW_RUN_ATTEMPT"
KEY_PATH="$HOME/.ssh/id_tai_qwen_preview"

cleanup() {
  rm -f "$KEY_PATH"
}
trap cleanup EXIT

[[ "$EXACT_MAIN" =~ ^[0-9a-f]{40}$ ]]
[[ "$WORKFLOW_RUN_ID" =~ ^[1-9][0-9]*$ ]]
[[ "$WORKFLOW_RUN_ATTEMPT" =~ ^[1-9][0-9]*$ ]]
[[ "$MODEL_HOST" =~ ^[A-Za-z0-9._:-]+$ ]]
[[ "$MODEL_SSH_PORT" =~ ^[0-9]{1,5}$ ]]
[[ "$MODEL_SSH_USER" == "tai-model" ]]
(( MODEL_SSH_PORT >= 1 && MODEL_SSH_PORT <= 65535 ))

rm -rf "$LOCAL_ROOT"
mkdir -p "$CONTROL_ROOT" "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
cp apps/tai/model-artifacts/qwen-preview-runtime-authority.v1.json "$CONTROL_ROOT/"
cp apps/tai/model-artifacts/qwen-preview-runtime.schema.v1.json "$CONTROL_ROOT/"
cp apps/tai/model-artifacts/qwen-preview-runtime-remote.v1.sh "$CONTROL_ROOT/"
(
  cd "$CONTROL_ROOT"
  sha256sum qwen-preview-runtime-authority.v1.json \
    qwen-preview-runtime.schema.v1.json \
    qwen-preview-runtime-remote.v1.sh > control-manifest.sha256
)
tar -czf "$LOCAL_ROOT/control-package.tar.gz" -C "$CONTROL_ROOT" .
sha256sum "$LOCAL_ROOT/control-package.tar.gz" > "$LOCAL_ROOT/control-package.tar.gz.sha256"

ssh-keyscan -T 30 -p "$MODEL_SSH_PORT" -H "$MODEL_HOST" > "$HOME/.ssh/known_hosts"
chmod 600 "$HOME/.ssh/known_hosts"
printf '%s\n' "$MODEL_SSH_KEY" > "$KEY_PATH"
chmod 600 "$KEY_PATH"

ssh_command() {
  ssh -i "$KEY_PATH" -p "$MODEL_SSH_PORT" \
    -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
    "$MODEL_SSH_USER@$MODEL_HOST" "$@"
}

scp_to_host() {
  scp -i "$KEY_PATH" -P "$MODEL_SSH_PORT" \
    -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
    "$1" "$MODEL_SSH_USER@$MODEL_HOST:$2"
}

scp_from_host() {
  scp -i "$KEY_PATH" -P "$MODEL_SSH_PORT" \
    -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
    "$MODEL_SSH_USER@$MODEL_HOST:$1" "$2"
}

ssh_command "install -d -m 700 '$REMOTE_ROOT/incoming' '$REMOTE_ROOT/control' '$REMOTE_ROOT/evidence'"
scp_to_host "$LOCAL_ROOT/control-package.tar.gz" "$REMOTE_ROOT/incoming/control-package.tar.gz"
scp_to_host "$LOCAL_ROOT/control-package.tar.gz.sha256" "$REMOTE_ROOT/incoming/control-package.tar.gz.sha256"

ssh_command "bash -s" <<REMOTE
set -Eeuo pipefail
cd '$REMOTE_ROOT/incoming'
sha256sum -c control-package.tar.gz.sha256
rm -rf '$REMOTE_ROOT/control.new'
mkdir -p '$REMOTE_ROOT/control.new'
tar -xzf control-package.tar.gz -C '$REMOTE_ROOT/control.new'
(cd '$REMOTE_ROOT/control.new' && sha256sum -c control-manifest.sha256)
rm -rf '$REMOTE_ROOT/control.previous'
if [[ -d '$REMOTE_ROOT/control' ]]; then mv '$REMOTE_ROOT/control' '$REMOTE_ROOT/control.previous'; fi
mv '$REMOTE_ROOT/control.new' '$REMOTE_ROOT/control'
chmod 700 '$REMOTE_ROOT/control/qwen-preview-runtime-remote.v1.sh'
bash '$REMOTE_ROOT/control/qwen-preview-runtime-remote.v1.sh' \
  '$REMOTE_ROOT' '$EXACT_MAIN' '$WORKFLOW_RUN_ID' '$WORKFLOW_RUN_ATTEMPT'
REMOTE

scp_from_host \
  "$REMOTE_ROOT/evidence/qwen-preview-runtime-evidence.json" \
  "$LOCAL_ROOT/qwen-preview-runtime-evidence.json"

test -s "$LOCAL_ROOT/qwen-preview-runtime-evidence.json"
python -m tai.qwen_preview_runtime_cli verify-evidence \
  apps/tai/model-artifacts/qwen-preview-runtime-authority.v1.json \
  "$LOCAL_ROOT/qwen-preview-runtime-evidence.json" \
  --exact-main "$EXACT_MAIN" \
  --evaluated-at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --output "$LOCAL_ROOT/verified-report.json"

cat > qwen-preview-summary.md <<EOF
## TAI Qwen read-only operational preview

- exact-main: \`$EXACT_MAIN\`;
- workflow run: \`$WORKFLOW_RUN_ID\` / attempt \`$WORKFLOW_RUN_ATTEMPT\`;
- result: \`READ_ONLY_OPERATIONAL_PREVIEW_PENDING_EXTERNAL_IMMUTABILITY\`;
- Qwen3-8B Q4_K_M: loopback-only RU/EN/ZH smoke verified;
- benchmark: \`PENDING_BENCHMARK\`;
- model admission: \`PENDING_ADMISSION\`;
- routing/UI/deployment: \`NOT_ACTIVATED\`;
- production operational status: \`NOT_ATTESTED\`.
EOF
