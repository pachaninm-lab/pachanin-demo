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
MODEL_SSH_PORT="${TAI_MODEL_SSH_PORT:-22}"
MODEL_HOST_FINGERPRINT="${TAI_MODEL_SSH_HOST_FINGERPRINT:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTROLLER_SOURCE="$SCRIPT_DIR/pc-tai-release-controller.sh"
CONTROLLER_TARGET="/usr/local/sbin/pc-tai-release-controller"

fail() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || fail "run as root from the REG.RU serial/VNC console"
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || fail "Linux x86_64 is required"
[[ "$REPOSITORY_URL" == "https://github.com/pachaninm-lab/pachanin-demo" ]] || fail "repository authority mismatch"
[[ "$RUNNER_NAME" =~ ^pc-prod-[A-Za-z0-9._-]{1,48}$ ]] || fail "runner name is invalid"
[[ -n "$REGISTRATION_TOKEN" && "$REGISTRATION_TOKEN" != *[[:space:]]* ]] || fail "RUNNER_REGISTRATION_TOKEN is required and normalized"
[[ "$REGISTRATION_TOKEN" =~ ^[A-Za-z0-9._=-]{20,256}$ ]] || fail "registration token format is invalid"
[[ "$MODEL_SSH_PORT" =~ ^[0-9]+$ ]] && ((MODEL_SSH_PORT >= 1 && MODEL_SSH_PORT <= 65535)) || fail "TAI_MODEL_SSH_PORT is invalid"
[[ "$MODEL_HOST_FINGERPRINT" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]] || fail "TAI_MODEL_SSH_HOST_FINGERPRINT is required"
[[ -f "$CONTROLLER_SOURCE" && ! -L "$CONTROLLER_SOURCE" ]] || fail "release controller source is unavailable"

for command in curl tar sha256sum systemctl useradd usermod gpasswd sudo visudo python3 find install git ssh-keyscan ssh-keygen flock; do
  command -v "$command" >/dev/null 2>&1 || fail "$command is required"
done
[[ -S /var/run/docker.sock ]] || fail "Docker socket is unavailable"
docker version >/dev/null
docker compose version >/dev/null

if ! id "$RUNNER_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$RUNNER_USER"
fi
if id -nG "$RUNNER_USER" | tr ' ' '\n' | grep -Fxq docker; then
  gpasswd -d "$RUNNER_USER" docker >/dev/null
fi
! id -nG "$RUNNER_USER" | tr ' ' '\n' | grep -Fxq docker || fail "runner user must not retain docker group"

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
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 "$RUNNER_URL" --output "$package"
  printf '%s  %s\n' "$RUNNER_PACKAGE_SHA256" "$package" | sha256sum --check --status || fail "runner package checksum mismatch"
  tar --extract --gzip --file "$package" --directory "$RUNNER_ROOT"
  [[ -x "$RUNNER_ROOT/bin/installdependencies.sh" ]] || fail "runner dependency installer is unavailable"
  "$RUNNER_ROOT/bin/installdependencies.sh"
  chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_ROOT"
  sudo -u "$RUNNER_USER" -H bash -c 'cd "$1"; shift; exec ./config.sh "$@"' bash "$RUNNER_ROOT" \
    --unattended --replace --url "$REPOSITORY_URL" --token "$REGISTRATION_TOKEN" \
    --name "$RUNNER_NAME" --labels "pc-prod,tai-readonly,tai-release" --work _work
fi

install -d -m 0700 -o root -g root /etc/pc-release-authority /var/lib/pc-release-authority /var/lib/pc-release-authority/repository /var/lib/pc-release-authority/controller-jobs
install -d -m 0700 -o "$RUNNER_USER" -g "$RUNNER_USER" /var/lib/pc-release-authority/runner-input
install -d -m 0750 -o root -g "$RUNNER_USER" /var/lib/pc-release-authority/runner-output
install -m 0750 -o root -g "$RUNNER_USER" "$CONTROLLER_SOURCE" "$CONTROLLER_TARGET"

scan="$(mktemp)"; match="$(mktemp)"
ssh-keyscan -T 10 -p "$MODEL_SSH_PORT" 192.168.0.206 2>/dev/null | sort -u > "$scan"
while IFS= read -r line; do
  fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fp" != "$MODEL_HOST_FINGERPRINT" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
[[ "$(grep -c . "$match" || true)" == 1 ]] || fail "private model host fingerprint mismatch"
install -m 0600 -o root -g root "$match" /etc/pc-release-authority/model_known_hosts
rm -f "$scan" "$match"

cat > /etc/sudoers.d/pc-tai-release-controller <<'SUDOERS'
Defaults:pcactions env_reset,use_pty,secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
pcactions ALL=(root) NOPASSWD: /usr/local/sbin/pc-tai-release-controller
SUDOERS
chmod 0440 /etc/sudoers.d/pc-tai-release-controller
visudo -cf /etc/sudoers.d/pc-tai-release-controller >/dev/null

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
cat > "$override_dir/hardening.conf" <<EOF2
[Service]
UMask=0077
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
RestrictRealtime=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
Restart=always
RestartSec=10s
EOF2
chmod 0644 "$override_dir/hardening.conf"
systemctl daemon-reload
systemctl enable --now "$service_name"
systemctl is-active --quiet "$service_name" || fail "runner service is not active"

sudo -u "$RUNNER_USER" -H sudo -n -l | grep -Fq "$CONTROLLER_TARGET" || fail "controller sudo authority is unavailable"
if sudo -u "$RUNNER_USER" -H docker version >/dev/null 2>&1; then fail "runner retained direct Docker authority"; fi

model_known_hosts_sha256="$(sha256sum /etc/pc-release-authority/model_known_hosts | awk '{print $1}')"
controller_sha256="$(sha256sum "$CONTROLLER_TARGET" | awk '{print $1}')"
python3 - /etc/pc-release-authority/actions-runner.json "$REPOSITORY_URL" "$RUNNER_NAME" "$RUNNER_VERSION" "$MODEL_SSH_PORT" "$MODEL_HOST_FINGERPRINT" "$model_known_hosts_sha256" "$controller_sha256" <<'PY'
import json, os, sys, tempfile
path, repository, name, version, model_port, model_fingerprint, known_hosts_sha, controller_sha = sys.argv[1:]
payload = {
  'schemaVersion':'pc.actions-runner-authority.v3',
  'repository':repository,
  'runnerName':name,
  'runnerVersion':version,
  'labels':['self-hosted','linux','x64','pc-prod','tai-readonly','tai-release'],
  'executionUser':'pcactions',
  'transport':'OUTBOUND_ONLY_HTTPS',
  'productionInboundSshRequired':False,
  'dockerSocketAccess':False,
  'sudoController':'/usr/local/sbin/pc-tai-release-controller',
  'sudoControllerSha256':controller_sha,
  'modelSshHost':'192.168.0.206',
  'modelSshPort':int(model_port),
  'modelHostFingerprint':model_fingerprint,
  'modelKnownHostsSha256':known_hosts_sha,
}
fd,tmp=tempfile.mkstemp(dir=os.path.dirname(path),prefix='.runner.',text=True)
try:
  with os.fdopen(fd,'w',encoding='utf-8') as h:
    json.dump(payload,h,ensure_ascii=True,separators=(',',':')); h.write('\n'); h.flush(); os.fsync(h.fileno())
  os.chmod(tmp,0o644); os.replace(tmp,path)
finally:
  if os.path.exists(tmp): os.unlink(tmp)
PY

unset REGISTRATION_TOKEN RUNNER_REGISTRATION_TOKEN MODEL_HOST_FINGERPRINT TAI_MODEL_SSH_HOST_FINGERPRINT
printf 'PC_PROD_ACTIONS_RUNNER=ACTIVE\n'
printf 'RUNNER_NAME=%s\n' "$RUNNER_NAME"
printf 'RUNNER_LABELS=self-hosted,linux,x64,pc-prod,tai-readonly,tai-release\n'
printf 'DIRECT_DOCKER_AUTHORITY=false\n'
printf 'ROOT_AUTHORITY=restricted-controller-only\n'
