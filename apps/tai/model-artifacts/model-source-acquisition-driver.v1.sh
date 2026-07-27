#!/usr/bin/env bash
#
# One command between "the owner has network access" and "the exact weights are
# on disk, verified".
#
# Everything else in the acquisition chain was already automated: reconciling
# the upstream inventory against the pinned authority, planning the download,
# collecting the source manifest, verifying a restore, assembling the report.
# The single step that was left to a human was the download itself — the part
# where a wrong revision, a partial file or a helpfully-substituted "latest"
# does the most damage and is the hardest to notice afterwards.
#
# This script closes that gap. It refuses before it fetches anything if the
# upstream revision does not match the authority, downloads only the files the
# authority selected, and re-derives the source manifest so the next stage can
# start immediately.
#
# It is deliberately dependency-light: bash, curl, python3 and the `tai`
# package. No Hugging Face client, no credentials, no tokens — the files it
# fetches are public, and adding an auth path would create a secret to manage
# for no benefit.
#
# Usage, on a machine that can reach huggingface.co:
#
#   ./model-source-acquisition-driver.v1.sh \
#       --model-id Qwen/Qwen3-8B \
#       --output-root /srv/tai/model-sources
#
# On success the output root holds the verified payload plus the reconciled
# inventory and source manifest, ready to be moved to the model host.

set -Eeuo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly ARTIFACT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TAI_ROOT="$(cd "${ARTIFACT_DIR}/.." && pwd)"
readonly AUTHORITY="${ARTIFACT_DIR}/model-bundle-authority.v2.json"

MODEL_ID=""
OUTPUT_ROOT=""
OBSERVED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Where to fetch from. Defaults to upstream; an operator behind a mirror or an
# air-gapped relay can point this elsewhere without editing the script. The
# revision and the file list still come from the authority, so a mirror can
# change where bytes are read from but never which bytes are accepted.
readonly UPSTREAM_ORIGIN="https://huggingface.co"
HUGGINGFACE_BASE="${TAI_HUGGINGFACE_BASE:-${UPSTREAM_ORIGIN}}"
HUGGINGFACE_BASE="${HUGGINGFACE_BASE%/}"

die() {
  printf '%s: %s\n' "${SCRIPT_NAME}" "$1" >&2
  exit 1
}

usage() {
  cat >&2 <<'USAGE'
Usage:
  model-source-acquisition-driver.v1.sh --model-id <id> --output-root <dir>

Options:
  --model-id     Model identifier exactly as pinned in the bundle authority,
                 for example Qwen/Qwen3-8B.
  --output-root  Directory that will hold the payload and the evidence. It is
                 created if absent and must be empty or previously produced by
                 this script.
USAGE
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model-id) MODEL_ID="${2:-}"; shift 2 ;;
    --output-root) OUTPUT_ROOT="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *) die "unknown argument: $1" ;;
  esac
done

[[ -n "${MODEL_ID}" ]] || usage
[[ -n "${OUTPUT_ROOT}" ]] || usage

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v python3 >/dev/null 2>&1 || die "python3 is required"

# The tai package uses PEP 695 generics, so an older interpreter fails deep
# inside an import with a bare SyntaxError. Saying so here costs one check and
# saves the operator from debugging a stack trace that names the wrong problem.
python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)' \
  || die "python3 3.12 or newer is required (found $(python3 -V 2>&1))"
[[ -f "${AUTHORITY}" ]] || die "bundle authority is missing: ${AUTHORITY}"

# The revision is read from the authority rather than taken as an argument. A
# revision the operator can type is a revision the operator can mistype, and the
# whole point of the pinned authority is that it decides.
REVISION="$(
  python3 - "${AUTHORITY}" "${MODEL_ID}" <<'PY'
import json
import sys

authority = json.load(open(sys.argv[1], encoding="utf-8"))
wanted = sys.argv[2]
for model in authority.get("models", []):
    if model.get("model_id") == wanted:
        print(model["revision"])
        break
else:
    sys.exit(f"model is not pinned in the authority: {wanted}")
PY
)" || die "could not resolve the pinned revision for ${MODEL_ID}"

printf '%s: %s pinned at %s\n' "${SCRIPT_NAME}" "${MODEL_ID}" "${REVISION}"

PAYLOAD_ROOT="${OUTPUT_ROOT}/payload"
EVIDENCE_ROOT="${OUTPUT_ROOT}/evidence"
mkdir -p "${PAYLOAD_ROOT}" "${EVIDENCE_ROOT}"

API_RESPONSE="${EVIDENCE_ROOT}/huggingface-api-response.json"
REMOTE_INVENTORY="${EVIDENCE_ROOT}/remote-inventory.json"
DOWNLOAD_PLAN="${EVIDENCE_ROOT}/download-plan.json"
SOURCE_MANIFEST="${EVIDENCE_ROOT}/source-manifest.json"

# Step 1: the upstream description of the exact revision, not of the branch.
# Asking for the revision by name is what makes "latest" unrepresentable here.
printf '%s: reading upstream metadata\n' "${SCRIPT_NAME}"
curl --fail --silent --show-error --location \
  --max-time 120 \
  "${HUGGINGFACE_BASE}/api/models/${MODEL_ID}/revision/${REVISION}" \
  --output "${API_RESPONSE}" \
  || die "could not read upstream metadata for ${MODEL_ID}@${REVISION}"

# Step 2: reconcile before fetching. This refuses on a revision mismatch, a
# licence mismatch, a file the authority does not govern, or a governed file
# that upstream no longer has. Downloading first and checking later would mean
# gigabytes of traffic before learning the answer is no.
printf '%s: reconciling upstream inventory against the authority\n' "${SCRIPT_NAME}"
(
  cd "${TAI_ROOT}"
  python3 -m tai.model_source_acquisition_cli reconcile-inventory \
    "${AUTHORITY}" \
    "${MODEL_ID}" \
    "${REVISION}" \
    "${API_RESPONSE}" \
    --observed-at "${OBSERVED_AT}" \
    --output "${REMOTE_INVENTORY}"
) || die "upstream inventory does not match the pinned authority; nothing was downloaded"

printf '%s: building the download plan\n' "${SCRIPT_NAME}"
(
  cd "${TAI_ROOT}"
  python3 -m tai.model_source_acquisition_cli download-plan \
    "${REMOTE_INVENTORY}" \
    --output "${DOWNLOAD_PLAN}"
) || die "could not build the download plan"

# Step 3: fetch exactly the selected entries. Nothing is inferred from the
# upstream file list at this point — the plan already decided.
TOTAL="$(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))["entries"]))' "${DOWNLOAD_PLAN}")"
printf '%s: downloading %s selected files\n' "${SCRIPT_NAME}" "${TOTAL}"

INDEX=0
while IFS=$'\t' read -r RELATIVE_PATH DOWNLOAD_URI EXPECTED_BYTES; do
  INDEX=$((INDEX + 1))
  TARGET="${PAYLOAD_ROOT}/${RELATIVE_PATH}"
  mkdir -p "$(dirname "${TARGET}")"

  # A file that is already the right size is left alone, so an interrupted run
  # resumes instead of starting over. The manifest step re-hashes everything
  # regardless, so a truncated file cannot survive by looking complete.
  if [[ -f "${TARGET}" ]]; then
    ACTUAL_BYTES="$(wc -c <"${TARGET}" | tr -d '[:space:]')"
    if [[ "${ACTUAL_BYTES}" == "${EXPECTED_BYTES}" ]]; then
      printf '  [%s/%s] %s (already present)\n' "${INDEX}" "${TOTAL}" "${RELATIVE_PATH}"
      continue
    fi
    rm -f "${TARGET}"
  fi

  printf '  [%s/%s] %s (%s bytes)\n' "${INDEX}" "${TOTAL}" "${RELATIVE_PATH}" "${EXPECTED_BYTES}"
  # The plan carries upstream URIs; a configured mirror replaces only the origin.
  FETCH_URI="${HUGGINGFACE_BASE}${DOWNLOAD_URI#${UPSTREAM_ORIGIN}}"
  curl --fail --silent --show-error --location \
    --retry 5 --retry-delay 5 --retry-connrefused \
    --output "${TARGET}.partial" \
    "${FETCH_URI}" \
    || die "download failed: ${RELATIVE_PATH}"

  ACTUAL_BYTES="$(wc -c <"${TARGET}.partial" | tr -d '[:space:]')"
  if [[ "${ACTUAL_BYTES}" != "${EXPECTED_BYTES}" ]]; then
    rm -f "${TARGET}.partial"
    die "size mismatch for ${RELATIVE_PATH}: expected ${EXPECTED_BYTES}, got ${ACTUAL_BYTES}"
  fi
  mv "${TARGET}.partial" "${TARGET}"
done < <(
  python3 - "${DOWNLOAD_PLAN}" <<'PY'
import json
import sys

plan = json.load(open(sys.argv[1], encoding="utf-8"))
for entry in plan["entries"]:
    # The authority stores paths prefixed by the model directory; the payload is
    # laid out the same way so the manifest step finds what it expects.
    print(f"{entry['path']}\t{entry['download_uri']}\t{entry['size_bytes']}")
PY
)

# Step 4: re-derive the manifest from what is actually on disk. This is the
# check that matters: it hashes every file rather than trusting the transfer.
printf '%s: collecting and hashing the source manifest\n' "${SCRIPT_NAME}"
(
  cd "${TAI_ROOT}"
  python3 -m tai.model_source_acquisition_cli collect-source \
    "${AUTHORITY}" \
    "${MODEL_ID}" \
    "${REVISION}" \
    "${REMOTE_INVENTORY}" \
    "${PAYLOAD_ROOT}" \
    --output "${SOURCE_MANIFEST}"
) || die "the downloaded payload does not match the reconciled inventory"

cat <<SUMMARY

${SCRIPT_NAME}: acquisition complete and verified.

  model      ${MODEL_ID}
  revision   ${REVISION}
  payload    ${PAYLOAD_ROOT}
  evidence   ${EVIDENCE_ROOT}

Next: move the output root to the model host, then continue with the legal
packet, restore verification and the acquisition report as described in
apps/tai/model-artifacts/model-bundle-acquisition-runbook.v2.md.
SUMMARY
