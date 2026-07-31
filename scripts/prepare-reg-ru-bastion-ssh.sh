#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SSH_ROOT="${HOME}/.ssh"
SSH_CONFIG="${SSH_ROOT}/config"
MODEL_KEY="${SSH_ROOT}/id_tai_model"
PROD_KEY="${SSH_ROOT}/id_pc_prod"
MODEL_KNOWN_HOSTS="${SSH_ROOT}/model_known_hosts"
PROD_KNOWN_HOSTS="${SSH_ROOT}/prod_known_hosts"
MODEL_ALIAS="tai-model-bastion"

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

validate_key_file() {
  local source="$1" target="$2" public_key
  tr -d '\r' < "$source" > "$target"
  chmod 0600 "$target"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$target" && return 1
  public_key="$(mktemp)"
  if ! ssh-keygen -y -P '' -f "$target" > "$public_key" 2>/dev/null; then
    rm -f "$public_key" "$target"
    return 1
  fi
  rm -f "$public_key"
}

try_key() {
  local raw="$1" target="$2" literal escaped decoded
  [[ -n "$raw" ]] || return 1
  literal="$(mktemp)"
  escaped="$(mktemp)"
  decoded="$(mktemp)"
  printf '%s\n' "$raw" > "$literal"
  if validate_key_file "$literal" "$target"; then
    rm -f "$literal" "$escaped" "$decoded"
    return 0
  fi
  printf '%s' "${raw//\\n/$'\n'}" > "$escaped"
  if validate_key_file "$escaped" "$target"; then
    rm -f "$literal" "$escaped" "$decoded"
    return 0
  fi
  if printf '%s' "$raw" | base64 --decode > "$decoded" 2>/dev/null \
    && validate_key_file "$decoded" "$target"; then
    rm -f "$literal" "$escaped" "$decoded"
    return 0
  fi
  rm -f "$literal" "$escaped" "$decoded" "$target"
  return 1
}

cleanup() {
  rm -f \
    "$SSH_CONFIG" \
    "$MODEL_KEY" \
    "$PROD_KEY" \
    "$MODEL_KNOWN_HOSTS" \
    "$PROD_KNOWN_HOSTS"
}

prepare() {
  local model_host model_user model_port prod_host prod_user prod_port
  local scan match fingerprint remote_scan_command

  model_host="$(trim "${MODEL_HOST_SECRET:-}")"
  model_user="$(trim "${MODEL_USER_SECRET:-root}")"
  model_port="$(trim "${MODEL_PORT_SECRET:-22}")"
  prod_host="$(trim "${PROD_HOST_SECRET:-${DEFAULT_PROD_HOST:-}}")"
  prod_user="$(trim "${PROD_USER_SECRET:-}")"
  prod_port="$(trim "${PROD_PORT_SECRET:-22}")"

  [[ -n "$model_host" && "$model_host" =~ ^[A-Za-z0-9.-]{1,253}$ ]]
  [[ "$model_user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
  [[ "$model_port" =~ ^[0-9]+$ ]] && ((model_port >= 1 && model_port <= 65535))
  [[ -n "${DEFAULT_PROD_HOST:-}" && "$prod_host" == "$DEFAULT_PROD_HOST" ]]
  [[ "$prod_host" =~ ^[0-9]{1,3}([.][0-9]{1,3}){3}$ ]]
  [[ -n "$prod_user" && "$prod_user" == "${PROD_USER_SECRET:-}" ]]
  [[ "$prod_user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
  [[ "$prod_port" =~ ^[0-9]+$ ]] && ((prod_port >= 1 && prod_port <= 65535))
  [[ "${PROD_HOST_FINGERPRINT:-}" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]

  cleanup
  mkdir -p "$SSH_ROOT"
  chmod 0700 "$SSH_ROOT"

  try_key "${MODEL_KEY_SECRET:-}" "$MODEL_KEY" \
    || try_key "${PROD_KEY_PRIMARY:-}" "$MODEL_KEY" \
    || try_key "${PROD_KEY_SECONDARY:-}" "$MODEL_KEY" \
    || try_key "${PROD_KEY_FALLBACK:-}" "$MODEL_KEY" \
    || { echo 'Protected model-host private key is unavailable.' >&2; exit 10; }
  try_key "${PROD_KEY_PRIMARY:-}" "$PROD_KEY" \
    || try_key "${PROD_KEY_SECONDARY:-}" "$PROD_KEY" \
    || try_key "${PROD_KEY_FALLBACK:-}" "$PROD_KEY" \
    || { echo 'Protected production private key is unavailable.' >&2; exit 11; }

  ssh-keyscan -T 10 -p "$model_port" "$model_host" 2>/dev/null \
    | sort -u > "$MODEL_KNOWN_HOSTS"
  [[ -s "$MODEL_KNOWN_HOSTS" ]]
  chmod 0600 "$MODEL_KNOWN_HOSTS"

  cat > "$SSH_CONFIG" <<EOF
Host ${MODEL_ALIAS}
  HostName ${model_host}
  User ${model_user}
  Port ${model_port}
  IdentityFile ${MODEL_KEY}
  UserKnownHostsFile ${MODEL_KNOWN_HOSTS}
  StrictHostKeyChecking yes
  BatchMode yes
  IdentitiesOnly yes
  ForwardAgent no
  ClearAllForwardings yes
  ExitOnForwardFailure yes
  ConnectTimeout 15

Host ${prod_host}
  HostName ${prod_host}
  User ${prod_user}
  Port ${prod_port}
  IdentityFile ${PROD_KEY}
  UserKnownHostsFile ${PROD_KNOWN_HOSTS}
  StrictHostKeyChecking yes
  BatchMode yes
  IdentitiesOnly yes
  ForwardAgent no
  ClearAllForwardings yes
  ExitOnForwardFailure yes
  ConnectTimeout 15
  ProxyJump ${MODEL_ALIAS}
EOF
  chmod 0600 "$SSH_CONFIG"

  ssh -F "$SSH_CONFIG" "$MODEL_ALIAS" 'printf MODEL_BASTION_READY' \
    | grep -Fxq MODEL_BASTION_READY

  remote_scan_command="ssh-keyscan -T 10 -p '${prod_port}' '${prod_host}' 2>/dev/null | sort -u"
  scan="$(mktemp)"
  match="$(mktemp)"
  ssh -F "$SSH_CONFIG" "$MODEL_ALIAS" "$remote_scan_command" > "$scan"
  [[ -s "$scan" ]]
  while IFS= read -r line; do
    fingerprint="$(printf '%s\n' "$line" \
      | ssh-keygen -lf - -E sha256 2>/dev/null \
      | awk '{print $2}' || true)"
    [[ "$fingerprint" != "$PROD_HOST_FINGERPRINT" ]] \
      || printf '%s\n' "$line" >> "$match"
  done < "$scan"
  [[ "$(grep -c . "$match" || true)" == 1 ]]
  mv "$match" "$PROD_KNOWN_HOSTS"
  rm -f "$scan"
  chmod 0600 "$PROD_KNOWN_HOSTS"

  ssh -F "$SSH_CONFIG" "$prod_user@$prod_host" 'printf PROD_VIA_BASTION_READY' \
    | grep -Fxq PROD_VIA_BASTION_READY

  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    {
      echo "model_host=$model_host"
      echo "model_user=$model_user"
      echo "model_port=$model_port"
      echo "prod_host=$prod_host"
      echo "prod_user=$prod_user"
      echo "prod_port=$prod_port"
      echo "ssh_config=$SSH_CONFIG"
      echo "transport=EPHEMERAL_PROXYJUMP"
    } >> "$GITHUB_OUTPUT"
  fi
  echo 'REG_RU_BASTION_TRANSPORT=READY'
}

case "${1:-prepare}" in
  prepare)
    prepare
    ;;
  cleanup)
    cleanup
    ;;
  *)
    echo 'Usage: prepare-reg-ru-bastion-ssh.sh [prepare|cleanup]' >&2
    exit 2
    ;;
esac
