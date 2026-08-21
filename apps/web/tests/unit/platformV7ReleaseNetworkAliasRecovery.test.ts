import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const workflow = fs.readFileSync(
  path.join(root, '../../.github/workflows/production-full-stack-network-alias-recovery.yml'),
  'utf8',
);

describe('production full-stack API network alias recovery', () => {
  it('is fail-closed and limited to a foreign compose-api network endpoint', () => {
    for (const marker of [
      'docker network disconnect -f',
      'FOREIGN_ALIAS_NOT_API_SERVICE',
      'FOREIGN_ALIAS_PROJECT_NOT_PROVABLY_STALE',
      'FOREIGN_ALIAS_NAME_NOT_COMPOSE_STALE',
      'API_ALIAS_UNIQUENESS=PASS',
      'AUTHORITATIVE_API_REVISION_UNCHANGED=PASS',
      'PRODUCTION_MUTATION=STALE_API_NETWORK_ALIAS_DISCONNECTED',
      "github.event.comment.performed_via_github_app.id == 1144995",
    ]) expect(workflow).toContain(marker);

    const runtime = workflow.split('      - name: Reconcile only duplicate foreign api alias', 2)[1];
    expect(runtime).toBeTruthy();
    for (const forbidden of [
      'docker rm',
      'docker stop',
      'docker kill',
      'docker restart',
      'docker network rm',
      'docker compose up',
      'docker system prune',
      'docker volume rm',
    ]) expect(runtime).not.toContain(forbidden);
  });
});
