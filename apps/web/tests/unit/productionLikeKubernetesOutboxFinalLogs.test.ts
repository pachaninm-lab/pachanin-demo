import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../../..');
const wrapper = fs.readFileSync(
  path.join(repoRoot, 'scripts/release/production-like-kubernetes-outbox-runtime.sh'),
  'utf8',
);

describe('production-like outbox final log collection', () => {
  it('waits for scale-down deletion to settle before enumerating worker pods', () => {
    expect(wrapper).toContain('select(.metadata.deletionTimestamp != null)');
    expect(wrapper).toContain('select(.metadata.deletionTimestamp == null)');
    expect(wrapper).toContain('test "$terminating_workers" = "0"');
    expect(wrapper).toContain('test "$active_workers" = "2"');
  });

  it('collects logs from the exact stable pod set instead of a racing label selector', () => {
    expect(wrapper).toContain('mapfile -t final_worker_pods');
    expect(wrapper).toContain('test "${#final_worker_pods[@]}" = "2"');
    expect(wrapper).toContain('for pod in "${final_worker_pods[@]}"; do');
    expect(wrapper).toContain('kubectl logs -n "$NAMESPACE" "pod/${pod}"');
    expect(wrapper).not.toContain(
      'kubectl logs -n "$NAMESPACE" -l "$WORKER_SELECTOR" --all-containers=true --prefix=true --tail=1000 \\\n  > "$RUNTIME_DIR/final-worker-logs.txt" 2>&1',
    );
  });

  it('reports log-collection and forbidden-runtime failures precisely', () => {
    expect(wrapper).toContain(
      'FAILURE_REASON="final outbox worker log collection was not stable after scale-down"',
    );
    expect(wrapper).toContain(
      'FAILURE_REASON="final outbox worker logs contain forbidden runtime errors"',
    );
  });
});
