import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const middleware = fs.readFileSync(path.join(root, 'apps/web/middleware.ts'), 'utf8');
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml'),
  'utf8',
);
const acceptance = fs.readFileSync(
  path.join(root, 'scripts/tai-potato-mobile-live-acceptance.mjs'),
  'utf8',
);

describe('TAI potato production regression', () => {
  it('forces public assistant POST requests to the model-first agro route', () => {
    expect(middleware).toContain("p === '/api/public-platform-assistant' && req.method === 'POST'");
    expect(middleware).toContain("u.pathname = '/api/agro-chat'");
    expect(middleware).toContain('NextResponse.rewrite(u)');
  });

  it('uses an attempt-scoped controller id instead of the GitHub run id filesystem path', () => {
    expect(workflow).toContain('CONTROLLER_RUN_ID');
    expect(workflow).toContain("format('{0}{1}', github.run_id, github.run_attempt)");
    expect(workflow).toContain('runner-input/${CONTROLLER_RUN_ID}');
    expect(workflow).toContain('runner-output/${{ env.CONTROLLER_RUN_ID }}/activation.json');
    expect(workflow).not.toContain('runner-input/${GITHUB_RUN_ID}');
  });

  it('proves the exact user question cannot resolve to the platform security article', () => {
    expect(acceptance).toContain("const QUESTION = 'Чем удобрять картошку';");
    expect(acceptance).toContain("'как защищаются данные'");
    expect(acceptance).toContain("assessment.source !== 'local_qwen'");
    expect(acceptance).toContain("assessment.answerMode !== 'general_agro'");
    expect(acceptance).toContain('TAI_POTATO_MOBILE_LIVE=PASS');
  });
});
