import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * ASVS 5.0 V6.1.3 asks that every authentication pathway be documented together
 * with its controls and its authentication strength; V6.3.4 adds that there must
 * be no undocumented ones.
 *
 * A document alone cannot satisfy either, because a document does not notice
 * when the code grows a pathway it does not mention - and that is not
 * hypothetical here. The inventory this file guards was written after a survey
 * found five session-minting surfaces that the security record did not name,
 * while the one surface it did name turned out to mint nothing at all.
 *
 * So the list lives in code. Every file that signs a session token or writes a
 * session cookie must appear below with the pathway it belongs to, and every
 * pathway named below must appear in the threat model. A new minting surface
 * fails this test until someone writes down what it proves.
 */

const THREAT_MODEL = 'docs/security/THREAT_MODEL.md';

/**
 * How a session comes into existence. Matching is on the raw file because a
 * commented-out mint is still not a mint; comments are stripped first so that
 * prose about a surface is not mistaken for the surface.
 */
const MINTING_PATTERNS = [
  ['auth-cookie-write', /\.set\s*\(\s*(?:ACCESS_COOKIE|REFRESH_COOKIE|SESSION_COOKIE|CABINET_SESSION_COOKIE)\b/u],
  ['raw-cookie-write', /document\.cookie\s*=\s*['"`]\s*(?:pc_access_token|pc_refresh_token|pc_session_present)/u],
  ['sign-access-token', /\bsignAccessToken\s*\(/u],
  ['sign-cabinet-session', /\bsignCabinetSession\s*\(/u],
  ['issue-refresh', /\bissueRefreshCredential\s*\(/u],
  ['issue-mfa-session', /\bissueMfaSession\s*\(/u],
];

/**
 * Every minting surface, and the pathway in the threat model it belongs to.
 *
 * `pathway` is the phrase the document must contain. `documented: false` marks a
 * file that mints on behalf of a pathway rather than being one - a signer or a
 * shared helper - which still has to be listed here so that adding one is a
 * deliberate act.
 */
const KNOWN_SURFACES = {
  'apps/api/src/modules/auth/access-token.ts': { pathway: null },
  'apps/api/src/modules/auth/auth.service.ts': { pathway: 'Platform login' },
  'apps/api/src/modules/auth/gekta-registration.service.ts': { pathway: 'Gekta registration email verification' },
  'apps/api/src/modules/auth/product-session.service.ts': { pathway: 'Gekta product login' },
  'apps/web/lib/platform-v7/verified-session.ts': { pathway: null },
  'apps/web/lib/server/auth-session-response.ts': { pathway: null },
  'apps/web/app/api/auth/demo/route.ts': { pathway: '/api/auth/demo' },
  'apps/web/app/api/auth/demo/role/[role]/route.ts': { pathway: '/api/auth/demo/role/[role]' },
  'apps/web/app/api/auth/demo/instant/[role]/route.ts': { pathway: '/api/auth/demo/instant/[role]' },
  'apps/web/app/platform-v7/staff/open-cabinet/route.ts': { pathway: '/platform-v7/staff/open-cabinet' },
  'apps/web/app/api/platform-v7/cabinet-session/route.ts': { pathway: '/api/platform-v7/cabinet-session' },
  'apps/web/app/api/platform-v7/cabinet-lock-login/route.ts': { pathway: '/api/platform-v7/cabinet-lock-login' },
};

function trackedSources() {
  return execFileSync('git', ['ls-files', 'apps'], { encoding: 'utf8' })
    .split('\n')
    .filter((path) => /\.tsx?$/u.test(path))
    .filter((path) => !/\.(?:spec|test)\.tsx?$/u.test(path) && !path.includes('/tests/'));
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/gu, '$1 ');
}

function discoverSurfaces() {
  const found = new Map();
  for (const path of trackedSources()) {
    const code = stripComments(readFileSync(path, 'utf8'));
    const kinds = MINTING_PATTERNS.filter(([, pattern]) => pattern.test(code)).map(([kind]) => kind);
    if (kinds.length > 0) found.set(path, kinds);
  }
  return found;
}

test('the tree is actually being read', () => {
  const sources = trackedSources();
  assert.ok(sources.length > 200, `expected a populated source tree, saw ${sources.length} files`);
});

test('every session-minting surface is inventoried', () => {
  const discovered = [...discoverSurfaces().keys()].sort();
  const known = Object.keys(KNOWN_SURFACES).sort();
  assert.deepEqual(
    discovered,
    known,
    'a file mints a session without being in the authentication-pathway inventory, '
      + 'or an inventoried file no longer mints one',
  );
});

test('every inventoried pathway is documented in the threat model', () => {
  const model = readFileSync(THREAT_MODEL, 'utf8');
  const missing = Object.entries(KNOWN_SURFACES)
    .map(([, entry]) => entry.pathway)
    .filter((pathway) => pathway !== null)
    .filter((pathway) => !model.includes(pathway));
  assert.deepEqual(missing, [], `${THREAT_MODEL} does not name these pathways`);
});

test('the threat model states the controls and the strength, not only the names', () => {
  const model = readFileSync(THREAT_MODEL, 'utf8');
  for (const required of [
    '## Authentication pathways',
    'Proof required',
    'Strength',
    '### Consistency',
  ]) {
    assert.ok(model.includes(required), `${THREAT_MODEL} is missing "${required}"`);
  }
});

/**
 * The detector has to be able to fail. If a pattern stopped matching, the
 * inventory test above would still pass on a shorter list only when the
 * inventory shrank to match - so the patterns are checked against the surfaces
 * they were written for.
 */
test('each detection pattern still matches something', () => {
  const kinds = new Set([...discoverSurfaces().values()].flat());
  const unused = MINTING_PATTERNS.map(([kind]) => kind).filter((kind) => !kinds.has(kind));
  assert.deepEqual(unused, [], 'a detection pattern matches nothing and would not notice a regression');
});
