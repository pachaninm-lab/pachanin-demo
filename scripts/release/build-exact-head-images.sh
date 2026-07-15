#!/usr/bin/env bash
set -euo pipefail

exact_head="${1:?exact head SHA is required}"
evidence_dir="${2:?evidence directory is required}"

if [[ ! "$exact_head" =~ ^[0-9a-f]{40}$ ]]; then
  echo "exact head must be a lowercase 40-character Git SHA" >&2
  exit 1
fi

mkdir -p "$evidence_dir"
build_date="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker buildx version | tee "$evidence_dir/docker-buildx-version.txt"

while read -r component dockerfile; do
  image="prozrachnaya-cena-${component}:release-${exact_head}"
  metadata="$evidence_dir/${component}-build-metadata.json"

  docker buildx build \
    --load \
    --provenance=false \
    --metadata-file "$metadata" \
    --build-arg GIT_COMMIT="$exact_head" \
    --build-arg BUILD_DATE="$build_date" \
    -f "$dockerfile" \
    -t "$image" \
    . 2>&1 | tee "$evidence_dir/docker-${component}.log"

  node - "$metadata" "$evidence_dir/${component}-digest.txt" <<'NODE'
const fs = require('node:fs');
const [metadataPath, digestPath] = process.argv.slice(2);
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const digest = metadata['containerimage.digest'];
if (!/^sha256:[0-9a-f]{64}$/.test(digest ?? '')) {
  throw new Error(`BuildKit metadata has no valid containerimage.digest in ${metadataPath}`);
}
fs.writeFileSync(digestPath, `${digest}\n`);
NODE

  docker image inspect --format='{{.Id}}' "$image" > "$evidence_dir/${component}-config-id.txt"
  docker image inspect --format='{{.Config.User}}' "$image" > "$evidence_dir/${component}-user.txt"
  docker image inspect --format='{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" > "$evidence_dir/${component}-revision.txt"

  test "$(cat "$evidence_dir/${component}-user.txt")" = nonroot
  test "$(cat "$evidence_dir/${component}-revision.txt")" = "$exact_head"
  grep -Eq '^sha256:[0-9a-f]{64}$' "$evidence_dir/${component}-digest.txt"
  grep -Eq '^sha256:[0-9a-f]{64}$' "$evidence_dir/${component}-config-id.txt"
done <<'COMPONENTS'
api infra/docker/Dockerfile.api
web infra/docker/Dockerfile.web
outbox-worker infra/docker/Dockerfile.outbox-worker
migration infra/docker/Dockerfile.migrations
COMPONENTS
