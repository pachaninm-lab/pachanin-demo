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
// The assessment rules are shared with the other hosted acceptance script, so
// they are pinned in the module both import rather than duplicated in each.
const contract = fs.readFileSync(
  path.join(root, 'scripts/tai-public-assessment-contract.mjs'),
  'utf8',
);

/**
 * The body of the `if` block that begins at `opener`, brace-balanced.
 *
 * Asserted against the block rather than the whole file so a match cannot be
 * satisfied by an unrelated rewrite elsewhere in the middleware, and so "this
 * request cannot reach the other handler" is a statement about the branch that
 * actually handles it.
 */
function branchBody(source: string, opener: string): string {
  const start = source.indexOf(opener);
  if (start < 0) throw new Error(`middleware branch not found: ${opener}`);
  let depth = 0;
  for (let i = start + opener.length - 1; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced middleware branch: ${opener}`);
}

describe('TAI broad agricultural production regression', () => {
  it('forces every public assistant POST request to the model-first agro route', () => {
    const opener = "if (p === '/api/public-platform-assistant' && req.method === 'POST') {";
    expect(middleware).toContain(opener);
    const branch = branchBody(middleware, opener);

    // The rewrite target is the model-first route, and it is the only target.
    expect(branch).toContain("u.pathname = '/api/agro-chat'");
    expect(branch.match(/u\.pathname\s*=/gu)).toHaveLength(1);

    // Rewritten to `u` — not to a fresh URL that could drift from the pathname
    // assigned above. The overload carrying request headers is what production
    // uses, so the assertion admits it instead of pinning the bare call.
    expect(branch).toMatch(/NextResponse\.rewrite\(\s*u\b/u);

    // The rewritten request must carry the forwarded headers; a rewrite that
    // dropped them would lose the resolved role on the model-first route.
    expect(branch).toContain('new Headers(req.headers)');
    expect(branch).toMatch(/NextResponse\.rewrite\(\s*u\s*,\s*\{\s*request:\s*\{\s*headers:\s*requestHeaders\s*\}\s*\}\s*\)/u);

    // And it must not be able to fall back to the non-model-first handler:
    // this branch returns, and never continues or hands off to the catalog.
    expect(branch).toMatch(/return applySecurityHeaders\(/u);
    expect(branch).not.toContain('NextResponse.next()');
    expect(branch).not.toContain('knowledgePost');
    expect(branch).not.toContain('public-platform-assistant/route');
  });

  it('uses an attempt-scoped controller id instead of the GitHub run id filesystem path', () => {
    // The id is derived once, from run id *and* attempt, so a re-run cannot
    // collide with the previous attempt's directory.
    expect(workflow).toMatch(
      /CONTROLLER_RUN_ID:\s*\$\{\{\s*format\('\{0\}\{1\}',\s*github\.run_id,\s*github\.run_attempt\)\s*\}\}/u,
    );

    // Both directories are addressed through that id. The job resolves it into
    // the shell environment, so shell expansion is the correct form here — the
    // previous pin required a GitHub expression the workflow does not use.
    expect(workflow).toMatch(/runner-input\/\$\{CONTROLLER_RUN_ID\}/u);
    expect(workflow).toMatch(/runner-output\/\$\{CONTROLLER_RUN_ID\}\/activation\.json/u);
    expect(workflow).toMatch(/runner-output\/\$\{CONTROLLER_RUN_ID\}\/finalization\.json/u);

    // The raw run id must never name an attempt directory: it is stable across
    // re-runs, which is exactly the collision the attempt id exists to prevent.
    expect(workflow).not.toMatch(/runner-(?:input|output)\/\$\{\{?\s*(?:env\.)?GITHUB_RUN_ID/u);
    expect(workflow).not.toMatch(/runner-(?:input|output)\/\$\{\{\s*github\.run_id\s*\}\}/u);

    // A reused attempt id stays refused, and the id itself stays constrained.
    expect(workflow).toContain('[[ "$CONTROLLER_RUN_ID" =~ ^[0-9]{2,20}$ ]]');
    expect(workflow).toMatch(/\[\[ ! -e "\$input" \]\] \|\|/u);
  });

  it('covers crops, gardens, livestock, machinery, storage, farm economics and village infrastructure', () => {
    const caseIds = [
      'potato-fertilizer',
      'cucumber-yellow-leaves',
      'wheat-low-yield',
      'tomato-blossom-drop',
      'apple-scab',
      'soil-acidity',
      'drip-irrigation',
      'cow-milk-drop',
      'pig-feed-conversion',
      'chicken-egg-drop',
      'bee-wintering',
      'tractor-overheat',
      'combine-losses',
      'mower-vibration',
      'grain-storage',
      'farm-costs',
      'village-water',
      'farm-excel',
      'potato-en',
      'cucumber-zh',
      'context-followup',
    ];
    expect(caseIds.length).toBeGreaterThanOrEqual(20);
    for (const id of caseIds) expect(acceptance).toContain(`id: '${id}'`);
  });

  it('requires real local Qwen, general agro mode, subject relevance and no platform-security misroute', () => {
    expect(contract).toContain('assessment.source !== REAL_QWEN_SOURCE');
    expect(contract).toContain("assessment.answerMode !== 'general_agro'");
    // The potato script validates through the shared contract, so a future
    // change that drops the call would leave these answers unchecked.
    expect(acceptance).toContain('normalizePublicQwenAssessment(assessment, testCase.id)');
    expect(acceptance).toContain('assertAgriculturalAnswer');
    expect(acceptance).toContain("'как защищаются данные'");
    expect(acceptance).toContain("'доступ назначает сервер'");
    expect(acceptance).toContain('TAI_AGRO_WIDE_MOBILE_LIVE=PASS');
  });

  it('checks RU plus representative EN and ZH questions and mobile UI cases', () => {
    expect(acceptance).toContain("id: 'potato-en'");
    expect(acceptance).toContain("id: 'cucumber-zh'");
    expect(acceptance).toContain('UI_CASE_IDS');
    expect(acceptance).toContain("viewport: '390x844'");
  });
});
