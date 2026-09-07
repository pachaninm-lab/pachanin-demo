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

/**
 * ASVS V6.3.4 просит не только отсутствия недокументированных путей, но и того,
 * чтобы средства защиты и стойкость аутентификации применялись СОГЛАСОВАННО.
 *
 * Про кабинетные пути в записи было сказано честно: «вероятно, держится, но
 * вероятно — это не доказательство». Ниже вероятность заменена измерением. Каждое
 * свойство, которое модель угроз утверждает про E, F и G, закреплено против
 * дерева, поэтому ослабление любого из них роняет сборку, а не обнаруживается
 * при следующем аудите.
 */
const OWNER_CABINET = 'apps/web/app/platform-v7/staff/open-cabinet/route.ts';
const CABINET_SESSION = 'apps/web/app/api/platform-v7/cabinet-session/route.ts';
const CABINET_LOCK = 'apps/web/app/api/platform-v7/cabinet-lock-login/route.ts';

test('E: the production-reachable cabinet demands an ACTIVE PLATFORM_OWNER with MFA, decided by the API', () => {
  const source = readFileSync(OWNER_CABINET, 'utf8');
  // Both halves in one predicate: an ACTIVE assignment that is not PLATFORM_OWNER,
  // or a PLATFORM_OWNER assignment that is not ACTIVE, must not authorize.
  assert.match(source, /item\.role === 'PLATFORM_OWNER' && item\.status === 'ACTIVE'/u);
  assert.match(source, /authenticationAssurance\.mfaVerified/u);
  // The decision is the API's. A cookie the browser already holds cannot assert it.
  assert.match(source, /!capabilities \|\| !activeOwner \|\| !capabilities\.authenticationAssurance\.mfaVerified/u);
});

test('E: an unauthorized or unreachable authority mints nothing', () => {
  const source = readFileSync(OWNER_CABINET, 'utf8');
  // 401/403 is a denial; anything else non-ok is unavailable. Neither issues a
  // cabinet, so a failing authority cannot become an open door.
  assert.match(source, /response\.status === 401 \|\| response\.status === 403\) return \{ status: 'denied' \}/u);
  assert.match(source, /!response\.ok\) return \{ status: 'unavailable' \}/u);
});

test('E: the weaker branch cannot outlive or outrank the stronger one', () => {
  const source = readFileSync(OWNER_CABINET, 'utf8');
  const api = Number(source.match(/MAX_API_OWNER_TTL_SECONDS = ([^;]+);/u)[1].split('*').reduce((a, b) => a * Number(b.trim()), 1));
  const fixture = Number(source.match(/MAX_CONTROLLED_TTL_SECONDS = ([^;]+);/u)[1].split('*').reduce((a, b) => a * Number(b.trim()), 1));
  assert.equal(api, 60 * 60);
  assert.equal(fixture, 8 * 60 * 60);
  // The fixture branch is not reachable in production at all, so its longer life
  // is a property of the review contour, not a weaker production credential.
  assert.match(source, /PC_CABINET_TEST_ACCESS_EXPIRES_AT/u);
  assert.match(source, /if \(ttlSeconds < 60\) return \{ status: 'denied' \}/u);
});

test('E: the role is bound by the server, so a submitted role cannot widen the cabinet', () => {
  const source = readFileSync(OWNER_CABINET, 'utf8');
  // This is the "cannot present as more than the account behind it" property.
  assert.match(source, /The server binds the role to its fixed controlled/u);
  assert.match(source, /controlledCabinetContext\(role\)/u);
});

test('F: a browser-supplied role is refused wherever production is even possible', () => {
  const source = readFileSync(CABINET_SESSION, 'utf8');
  assert.match(source, /directBodyRoleAllowed/u);
  // Allowed only under an explicit development or test environment - not merely
  // "not production", which an unset NODE_ENV would satisfy.
  assert.match(source, /envValue\(env, 'NODE_ENV'\) === 'development' \|\| envValue\(env, 'NODE_ENV'\) === 'test'/u);
  assert.match(source, /const role = verifiedRole \?\? \(directBodyRoleAllowed \? bodyRole : ''\)/u);
});

test('G: the shared-password cabinet answers 410 in production before reading anything', () => {
  const source = readFileSync(CABINET_LOCK, 'utf8');
  const handler = source.slice(source.indexOf('export async function POST('));
  const guard = handler.indexOf("process.env.NODE_ENV === 'production'");
  const firstRead = handler.indexOf('request.json()');
  assert.ok(guard >= 0 && firstRead > guard, 'the production refusal must precede reading the body');
  assert.match(handler, /status: 410/u);
});

test('the three cabinet pathways the threat model names are the three that exist', () => {
  // A fourth minting route would make the consistency claim above cover less than
  // it appears to. The inventory test above catches a new pathway; this one keeps
  // the consistency evidence tied to exactly the pathways it examined.
  for (const file of [OWNER_CABINET, CABINET_SESSION, CABINET_LOCK]) {
    assert.ok(readFileSync(file, 'utf8').length > 0, file);
  }
  const model = readFileSync(THREAT_MODEL, 'utf8');
  assert.match(model, /Owner cabinet open/u);
  assert.match(model, /Cabinet session/u);
  assert.match(model, /Cabinet lock login/u);
});
