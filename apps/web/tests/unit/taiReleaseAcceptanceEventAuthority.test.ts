import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFile), '../../../..');
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/tai-release-acceptance.yml'),
  'utf8',
);

describe('TAI exact-main workflow event authority', () => {
  it('uses push runs for release evidence and cannot let a scheduled audit replace them', () => {
    expect(workflow).toContain('release_event = "push"');
    expect(workflow).toContain('run.get("head_sha") != exact_head');
    expect(workflow).toContain('run.get("event") != release_event');
    expect(workflow).toContain('/actions/runs?head_sha=${EXACT_HEAD}&per_page=100');
    expect(workflow).not.toContain('release_event = "schedule"');
  });
});
