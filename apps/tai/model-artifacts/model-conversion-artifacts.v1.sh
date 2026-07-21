mkdir -p accepted-artifacts/{qwen3-8b,mistral-7b-instruct-v0.3,toolchain}
python - <<'PY' > accepted-artifacts/artifacts.tsv
import json
from pathlib import Path
authority = json.loads(Path('apps/tai/model-artifacts/model-conversion-authority.v1.json').read_text())
for model in authority['models']:
    print('\t'.join((model['key'], str(model['metadata_artifact_id']), model['metadata_artifact_digest'])))
toolchain = authority['toolchain_acceptance']
print('\t'.join(('toolchain', str(toolchain['package_artifact_id']), toolchain['package_artifact_digest'])))
PY
while IFS=$'\t' read -r key artifact_id expected_digest; do
  gh api -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' \
    "repos/$REPOSITORY/actions/artifacts/$artifact_id" > "accepted-artifacts/$key/artifact.json"
  KEY="$key" ARTIFACT_ID="$artifact_id" EXPECTED_DIGEST="$expected_digest" python - <<'PY'
import json
import os
import re
from pathlib import Path
artifact = json.loads(Path(f"accepted-artifacts/{os.environ['KEY']}/artifact.json").read_text())
assert artifact['id'] == int(os.environ['ARTIFACT_ID'])
assert artifact['expired'] is False
digest = artifact.get('digest', '')
assert re.fullmatch(r'sha256:[0-9a-f]{64}', digest)
assert digest.split(':', 1)[1] == os.environ['EXPECTED_DIGEST']
PY
  gh api "repos/$REPOSITORY/actions/artifacts/$artifact_id/zip" > "accepted-artifacts/$key/artifact.zip"
  test "$(sha256sum "accepted-artifacts/$key/artifact.zip" | awk '{print $1}')" = "$expected_digest"
  unzip -q "accepted-artifacts/$key/artifact.zip" -d "accepted-artifacts/$key/content"
done < accepted-artifacts/artifacts.tsv

python - <<'PY'
import hashlib
import json
from pathlib import Path

authority = json.loads(Path('apps/tai/model-artifacts/model-conversion-authority.v1.json').read_text())
canonical = lambda value: json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
for model in authority['models']:
    root = Path('accepted-artifacts') / model['key'] / 'content'
    manifest = json.loads((root / 'source-manifest.json').read_text())
    plan = json.loads((root / 'download-plan.json').read_text())
    report = json.loads((root / 'acquisition-report.json').read_text())
    assert report['status'] == authority['source_acceptance']['status']
    assert report['model_id'] == model['model_id'] and report['revision'] == model['revision']
    assert report['source_manifest_sha256'] == model['source_manifest_sha256']
    assert report['source_files_sha256'] == model['source_files_sha256']
    assert hashlib.sha256(canonical(manifest).encode()).hexdigest() == model['source_manifest_sha256']
    assert manifest['source_files_sha256'] == model['source_files_sha256']
    assert plan['model_id'] == model['model_id'] and plan['revision'] == model['revision']
    assert {item['path'] for item in plan['entries']} == {item['path'] for item in manifest['files']}
root = Path('accepted-artifacts/toolchain/content')
package = root / 'llama-cpp-b9637-evidence.tar.gz'
index = json.loads((root / 'package-index.v1.json').read_text())
expected = authority['toolchain_acceptance']
value = hashlib.sha256()
with package.open('rb') as stream:
    while chunk := stream.read(1024 * 1024):
        value.update(chunk)
assert package.stat().st_size == expected['package_size_bytes']
assert value.hexdigest() == expected['package_sha256']
assert index['status'] == 'PACKAGED'
assert index['package']['sha256'] == expected['package_sha256']
assert index['authority_sha256'] == expected['authority_sha256']
PY

mkdir -p control-package/source-metadata/{qwen3-8b,mistral-7b-instruct-v0.3} control-package/toolchain
cp apps/tai/model-artifacts/model-conversion-driver.v1.sh control-package/
cp "$CONVERSION_AUTHORITY" control-package/model-conversion-authority.v1.json
cp accepted-artifacts/qwen3-8b/content/{source-manifest.json,download-plan.json,acquisition-report.json} control-package/source-metadata/qwen3-8b/
cp accepted-artifacts/mistral-7b-instruct-v0.3/content/{source-manifest.json,download-plan.json,acquisition-report.json} control-package/source-metadata/mistral-7b-instruct-v0.3/
cp accepted-artifacts/toolchain/content/{llama-cpp-b9637-evidence.tar.gz,package-index.v1.json} control-package/toolchain/
cp prerequisite-evidence/legal-evaluation.json control-package/
cp prerequisite-evidence/release/artifact/tai-release-attestation.json control-package/
COMMITTED_AUTHORITY_SHA256="$(cat prerequisite-evidence/conversion-authority-sha256.txt)" \
RELEASE_RUN_ID="$RELEASE_RUN_ID" RELEASE_ARTIFACT_ID="$RELEASE_ARTIFACT_ID" python - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path
path = Path('control-package/model-conversion-authority.v1.json')
payload = json.loads(path.read_text())
payload['execution'] = {
    'exact_main_sha': os.environ['GITHUB_SHA'],
    'workflow_run_id': int(os.environ['GITHUB_RUN_ID']),
    'workflow_run_attempt': int(os.environ['GITHUB_RUN_ATTEMPT']),
    'release_acceptance_run_id': int(os.environ['RELEASE_RUN_ID']),
    'release_acceptance_artifact_id': int(os.environ['RELEASE_ARTIFACT_ID']),
    'committed_authority_sha256': os.environ['COMMITTED_AUTHORITY_SHA256'],
    'created_at': datetime.now(timezone.utc).isoformat(),
}
path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + '\n')
PY
(
  cd control-package
  find . -type f ! -name control-manifest.sha256 -print0 \
    | LC_ALL=C sort -z \
    | xargs -0 sha256sum > control-manifest.sha256
)
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner \
  -C control-package -cf - . | gzip -n -9 > control-package.tar.gz
sha256sum control-package.tar.gz > control-package.tar.gz.sha256
