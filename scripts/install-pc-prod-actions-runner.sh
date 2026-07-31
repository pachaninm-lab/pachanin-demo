#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RUNNER_VERSION="2.336.0"
RUNNER_PACKAGE_SHA256="04cf0be1aff4c3ec3554466c39124ca250e3effd8873bb7e8d68535aa9505d5d"
RUNNER_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
REPOSITORY_URL="${REPOSITORY_URL:-https://github.com/pachaninm-lab/pachanin-demo}"
RUNNER_USER="${RUNNER_USER:-pcactions}"
RUNNER_ROOT="${RUNNER_ROOT:-/opt/actions-runner-pc-prod}"
RUNNER_NAME="${RUNNER_NAME:-pc-prod-$(hostname -s)}"
REGISTRATION_TOKEN="${RUNNER_REGISTRATION_TOKEN:-}"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

[[ "$(id -u)" -eq 0 ]] || fail "run as root from the REG.RU serial/VNC console"
[[ "$(uname -s)" == Linux ]] || fail "Linux is required"
[[ "$(uname -m)" == x86_64 ]] || fail "x86_64 is required"
[[ "$REPOSITORY_URL" == "https://github.com/pachaninm-lab/pachanin-demo" ]] || fail "repository authority mismatch"
[[ "$RUNNER_NAME" =~ ^pc-prod-[A-Za-z0-9._-]{1,48}$ ]] || fail "runner name is invalid"
[[ -n "$REGISTRATION_TOKEN" ]] || fail "RUNNER_REGISTRATION_TOKEN is required"
[[ "$REGISTRATION_TOKEN" != *[[:space:]]* ]] || fail "registration token contains whitespace"
[[ "$REGISTRATION_TOKEN" =~ ^[A-Za-z0-9._=-]{20,256}$ ]] || fail "registration token format is invalid"

for command in curl tar sha256sum systemctl useradd usermod sudo python3; do
  command -v "$command" >/dev/null 2>&1 || fail "$command is required"
done
getent group docker >/dev/null 2>&1 || fail "docker group is required"
[[ -S /var/run/docker.sock ]] || fail "Docker socket is unavailable"

docker version >/dev/null
docker compose version >/dev/null

if ! id "$RUNNER_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$RUNNER_USER"
fi
usermod -aG docker "$RUNNER_USER"
install -d -m 0750 -o "$RUNNER_USER" -g "$RUNNER_USER" "$RUNNER_ROOT"

if [[ -f "$RUNNER_ROOT/.runner" ]]; then
  existing_name="$(python3 - "$RUNNER_ROOT/.runner" <<'PY'
import json, sys
try:
    print(json.load(open(sys.argv[1], encoding='utf-8')).get('agentName', ''))
except Exception:
    print('')
PY
  )"
  [[ "$existing_name" == "$RUNNER_NAME" ]] || fail "an existing runner has a different identity"
else
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT
  package="$work/actions-runner.tar.gz"
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
    "$RUNNER_URL" --output "$package"
  printf '%s  %s\n' "$RUNNER_PACKAGE_SHA256" "$package" | sha256sum --check --status \
    || fail "runner package checksum mismatch"
  tar --extract --gzip --file "$package" --directory "$RUNNER_ROOT"
  chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_ROOT"
  sudo -u "$RUNNER_USER" -H "$RUNNER_ROOT/bin/installdependencies.sh"
  sudo -u "$RUNNER_USER" -H bash -c \
    'cd "$1"; shift; exec ./config.sh "$@"' bash "$RUNNER_ROOT" \
    --unattended --replace --url "$REPOSITORY_URL" --token "$REGISTRATION_TOKEN" \
    --name "$RUNNER_NAME" --labels "pc-prod,tai-readonly" --work _work
fi

cd "$RUNNER_ROOT"
service_file="$(find /etc/systemd/system -maxdepth 1 -type f -name "actions.runner.pachaninm-lab-pachanin-demo.${RUNNER_NAME}.service" -print -quit)"
if [[ -z "$service_file" ]]; then
  ./svc.sh install "$RUNNER_USER"
  service_file="$(find /etc/systemd/system -maxdepth 1 -type f -name "actions.runner.pachaninm-lab-pachanin-demo.${RUNNER_NAME}.service" -print -quit)"
fi
[[ -n "$service_file" ]] || fail "runner systemd service was not created"
service_name="$(basename "$service_file")"

override_dir="/etc/systemd/system/${service_name}.d"
install -d -m 0755 "$override_dir"
cat > "$override_dir/hardening.conf" <<EOF
[Service]
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
RestrictRealtime=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
ReadWritePaths=$RUNNER_ROOT
Restart=always
RestartSec=10s
EOF
chmod 0644 "$override_dir/hardening.conf"

systemctl daemon-reload
systemctl enable --now "$service_name"
systemctl is-active --quiet "$service_name" || fail "runner service is not active"
sudo -u "$RUNNER_USER" -H docker version >/dev/null
sudo -u "$RUNNER_USER" -H docker compose version >/dev/null

install -d -m 0755 /etc/pc-release-authority
python3 - /etc/pc-release-authority/actions-runner.json \
  "$REPOSITORY_URL" "$RUNNER_NAME" "$RUNNER_VERSION" <<'PY'
import json, os, sys, tempfile
path, repository, name, version = sys.argv[1:]
payload = {
    "schemaVersion": "pc.actions-runner-authority.v1",
    "repository": repository,
    "runnerName": name,
    "runnerVersion": version,
    "labels": ["self-hosted", "linux", "x64", "pc-prod", "tai-readonly"],
    "transport": "OUTBOUND_ONLY",
}
fd, temporary = tempfile.mkstemp(dir=os.path.dirname(path), prefix='.runner.', text=True)
try:
    with os.fdopen(fd, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=True, separators=(',', ':'))
        handle.write('\n')
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(temporary, 0o644)
    os.replace(temporary, path)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
PY

unset REGISTRATION_TOKEN RUNNER_REGISTRATION_TOKEN
printf 'PC_PROD_ACTIONS_RUNNER=ACTIVE\n'
printf 'RUNNER_NAME=%s\n' "$RUNNER_NAME"
printf 'RUNNER_LABELS=self-hosted,linux,x64,pc-prod,tai-readonly\n'
printf 'TRANSPORT=OUTBOUND_ONLY\n'
