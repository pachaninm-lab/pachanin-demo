#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${GITHUB_SHA:?}"
: "${GITHUB_RUN_ID:?}"
: "${GITHUB_RUN_ATTEMPT:?}"
: "${GITHUB_REPOSITORY:?}"
: "${GH_TOKEN:?}"
: "${MODEL_HOST:?}"

REPOSITORY="$GITHUB_REPOSITORY"
CONVERSION_AUTHORITY="apps/tai/model-artifacts/model-conversion-authority.v1.json"
BUNDLE_AUTHORITY="apps/tai/model-artifacts/model-bundle-authority.v2.json"
LEGAL_AUTHORITY="apps/tai/model-artifacts/model-legal-review-authority.v1.json"
SOURCE_ACCEPTANCE="apps/tai/model-artifacts/model-source-acquisition-acceptance.v1.json"
REMOTE_ROOT="/srv/tai-models/conversion-runs/$GITHUB_SHA/$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
SUMMARY_PATH="conversion-summary.md"
MONITOR_STATE="FAILED_CLOSED"

write_summary() {
  SUMMARY_STATE="$MONITOR_STATE" SUMMARY_REMOTE_ROOT="$REMOTE_ROOT" python - <<'PY' > "$SUMMARY_PATH"
import json
import os
from pathlib import Path

lines = [
    '## TAI governed model conversion',
    '',
    f"- exact-main: `{os.environ['GITHUB_SHA']}`;",
    f"- workflow run: `{os.environ['GITHUB_RUN_ID']}` / attempt `{os.environ['GITHUB_RUN_ATTEMPT']}`;",
    f"- remote state: `{os.environ.get('SUMMARY_STATE', 'UNKNOWN')}`;",
    f"- dedicated run root: `{os.environ.get('SUMMARY_REMOTE_ROOT', 'UNAVAILABLE')}`;",
]
report_path = Path('remote-evidence/evidence/conversion-report.json')
if report_path.exists():
    report = json.loads(report_path.read_text())
    lines.extend([
        f"- result status: `{report.get('status')}`;",
        f"- outputs: `{len(report.get('outputs', []))}`;",
        f"- report SHA-256: `{report.get('report_sha256')}`;",
    ])
    for output in report.get('outputs', []):
        lines.append(
            f"  - `{output['path']}`: `{output['size_bytes']}` bytes / "
            f"`sha256:{output['sha256']}`;"
        )
lines.extend([
    '- benchmark: `NOT_RUN`;',
    '- model admission: `NOT_DONE`;',
    '- production operational status: `NOT_ATTESTED`;',
    '- large model and GGUF bytes remain outside Git.',
])
print('\n'.join(lines))
PY
}
trap 'write_summary' EXIT

mkdir -p prerequisite-evidence/release remote-evidence

for attempt in $(seq 1 30); do
  gh api -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    "repos/$REPOSITORY/actions/runs?head_sha=$GITHUB_SHA&per_page=100" \
    > prerequisite-evidence/release/runs.json
  set +e
  python - <<'PY'
import json
import os
from pathlib import Path

exact = os.environ['GITHUB_SHA']
runs = json.loads(Path('prerequisite-evidence/release/runs.json').read_text()).get('workflow_runs', [])
candidates = [
    run for run in runs
    if run.get('name') == 'TAI Release Acceptance'
    and run.get('path') == '.github/workflows/tai-release-acceptance.yml'
    and run.get('head_sha') == exact
    and run.get('head_branch') == 'main'
    and run.get('event') in {'push', 'workflow_dispatch'}
]
if not candidates:
    raise SystemExit(3)
run = max(candidates, key=lambda item: (item.get('run_number', 0), item.get('id', 0)))
if run.get('status') != 'completed':
    raise SystemExit(3)
if run.get('conclusion') != 'success':
    raise SystemExit(2)
Path('prerequisite-evidence/release/selected-run.json').write_text(
    json.dumps(run, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
)
PY
  status=$?
  set -e
  if [[ "$status" -eq 0 ]]; then break; fi
  if [[ "$status" -eq 2 ]]; then echo 'Exact-main Release Acceptance failed.' >&2; exit 1; fi
  if [[ "$attempt" -eq 30 ]]; then echo 'Exact-main Release Acceptance is pending or absent.' >&2; exit 1; fi
  sleep 20
done

export RELEASE_RUN_ID="$(python -c 'import json; print(json.load(open("prerequisite-evidence/release/selected-run.json"))["id"])')"
gh api -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  "repos/$REPOSITORY/actions/runs/$RELEASE_RUN_ID/artifacts?per_page=100" \
  > prerequisite-evidence/release/artifacts.json
python - <<'PY'
import json
import os
from pathlib import Path

exact = os.environ['GITHUB_SHA']
run_id = int(os.environ['RELEASE_RUN_ID'])
artifacts = json.loads(Path('prerequisite-evidence/release/artifacts.json').read_text()).get('artifacts', [])
expected = f'tai-release-attestation-{exact}'
matches = [item for item in artifacts if item.get('name') == expected and item.get('expired') is False
           and item.get('workflow_run', {}).get('id') == run_id
           and item.get('workflow_run', {}).get('head_sha') == exact]
if len(matches) != 1:
    raise SystemExit('RELEASE_ARTIFACT_CARDINALITY_INVALID')
Path('prerequisite-evidence/release/selected-artifact.json').write_text(
    json.dumps(matches[0], ensure_ascii=False, indent=2, sort_keys=True) + '\n'
)
PY
export RELEASE_ARTIFACT_ID="$(python -c 'import json; print(json.load(open("prerequisite-evidence/release/selected-artifact.json"))["id"])')"
gh api "repos/$REPOSITORY/actions/artifacts/$RELEASE_ARTIFACT_ID/zip" \
  > prerequisite-evidence/release/artifact.zip
unzip -q prerequisite-evidence/release/artifact.zip -d prerequisite-evidence/release/artifact
python - <<'PY'
import json
import os
from pathlib import Path
attestation = json.loads(Path('prerequisite-evidence/release/artifact/tai-release-attestation.json').read_text())
assert attestation['exact_main_sha'] == os.environ['GITHUB_SHA']
assert attestation['accepted'] is True
assert attestation['reasons'] == []
assert attestation['production_operational_status'] == 'NOT_ATTESTED'
PY

PYTHONPATH=apps/tai python -m tai.model_artifact_registry_cli \
  validate-bundle-authority-v2 "$BUNDLE_AUTHORITY" \
  --output prerequisite-evidence/bundle-authority.json
PYTHONPATH=apps/tai python -m tai.model_legal_review_cli \
  evaluate-all "$LEGAL_AUTHORITY" "$SOURCE_ACCEPTANCE" apps/tai \
  --output prerequisite-evidence/legal-evaluation.json
python - <<'PY'
import hashlib
import json
from pathlib import Path

conversion = json.loads(Path('apps/tai/model-artifacts/model-conversion-authority.v1.json').read_text())
bundle = json.loads(Path('prerequisite-evidence/bundle-authority.json').read_text())
legal = json.loads(Path('prerequisite-evidence/legal-evaluation.json').read_text())
source = json.loads(Path('apps/tai/model-artifacts/model-source-acquisition-acceptance.v1.json').read_text())
toolchain = json.loads(Path('apps/tai/model-artifacts/llama-cpp-build-acceptance.v1.json').read_text())
canonical = lambda value: json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
assert conversion['schema_version'] == 'tai.model-conversion-authority.v1'
assert (conversion['program_issue'], conversion['parent_issue'], conversion['issue']) == (2726, 2835, 2932)
assert conversion['command'] == '/tai convert model-bundles exact-main'
assert conversion['target']['host_role'] == 'DEDICATED_MODEL_HOST'
assert conversion['target']['production_fallback_allowed'] is False
assert conversion['target']['ssh_secret_prefix'] == 'TAI_MODEL_'
assert conversion['bundle_authority']['authority_sha256'] == bundle['authority_sha256']
assert bundle['status'] == 'VALID'
assert legal['status'] == conversion['legal_review']['required_status']
assert legal['conversion_authorized_models'] == ['Qwen/Qwen3-8B', 'mistralai/Mistral-7B-Instruct-v0.3']
assert legal['authority_sha256'] == conversion['legal_review']['authority_sha256']
assert legal['intended_use_sha256'] == conversion['legal_review']['intended_use_sha256']
assert source['status'] == conversion['source_acceptance']['status']
assert source['source_acquisition']['run_id'] == conversion['source_acceptance']['workflow_run_id']
assert toolchain['status'] == conversion['toolchain_acceptance']['status']
assert toolchain['authority']['commit'] == conversion['toolchain_acceptance']['commit']
assert toolchain['authority']['authority_sha256'] == conversion['toolchain_acceptance']['authority_sha256']
assert toolchain['external_artifacts']['package_artifact']['id'] == conversion['toolchain_acceptance']['package_artifact_id']
assert toolchain['external_artifacts']['package_artifact']['payload_sha256'] == conversion['toolchain_acceptance']['package_sha256']
Path('prerequisite-evidence/conversion-authority-sha256.txt').write_text(
    hashlib.sha256(canonical(conversion).encode()).hexdigest() + '\n'
)
PY
