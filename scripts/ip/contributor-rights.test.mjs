import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { aiInvolvementFor, evaluateRights, parseRightsRegister, rightsSets } from './contributor-rights.mjs';

const OWNER = 'owner@example.test';
const AI = 'ai@example.test';
const BOT = 'bot@example.test';
const STRANGER = 'stranger@example.test';

function register(overrides = []) {
  return {
    schemaVersion: 1,
    identities: [
      { contributorClass: 'OWNER', emails: [OWNER], rightsBasis: 'PRINCIPAL_AUTHOR', rightsStatus: 'RESOLVED' },
      { contributorClass: 'AI_ASSISTANT', emails: [AI], rightsBasis: 'PROVIDER_TERMS', rightsStatus: 'RESOLVED' },
      { contributorClass: 'AUTOMATION_BOT', emails: [BOT], rightsBasis: 'REPO_AUTOMATION', rightsStatus: 'RESOLVED' },
      { contributorClass: 'THIRD_PARTY_HUMAN', emails: [STRANGER], rightsBasis: 'NONE', rightsStatus: 'UNRESOLVED' },
      ...overrides,
    ],
  };
}
const SETS = rightsSets(parseRightsRegister(register()).byEmail);
const never = () => { throw new Error('blame must not be needed on the touch-history tier'); };

test('a file only ever touched by resolved identities clears without being blamed', () => {
  const evidence = evaluateRights(new Set([OWNER, AI, BOT]), never, SETS);
  assert.equal(evidence.tier, 'TOUCH_HISTORY');
});

// The load-bearing gate: an unresolved contributor's surviving lines must block.
test('an unresolved author with surviving lines blocks the file', () => {
  const evidence = evaluateRights(new Set([OWNER, STRANGER]), () => new Set([OWNER, STRANGER]), SETS);
  assert.equal(evidence, null);
});

test('an unresolved author whose lines were all replaced no longer blocks', () => {
  const evidence = evaluateRights(new Set([OWNER, STRANGER]), () => new Set([OWNER]), SETS);
  assert.equal(evidence.tier, 'SURVIVING_LINE');
  assert.match(evidence.detail, /no line of theirs survives/u);
});

// An address nobody has classified must never inherit a neighbour's rights basis.
test('an author address absent from the register is treated as unresolved', () => {
  assert.equal(evaluateRights(new Set([OWNER, 'ghost@example.test']), () => new Set([OWNER, 'ghost@example.test']), SETS), null);
  assert.equal(evaluateRights(new Set(['ghost@example.test']), () => new Set(['ghost@example.test']), SETS), null);
});

test('a file with no recorded authorship never clears', () => {
  assert.equal(evaluateRights(new Set(), never, SETS), null);
  assert.equal(evaluateRights(null, never, SETS), null);
});

test('an unblameable or empty-blame file stays unresolved rather than passing', () => {
  assert.equal(evaluateRights(new Set([STRANGER]), () => null, SETS), null);
  assert.equal(evaluateRights(new Set([STRANGER]), () => new Set(), SETS), null);
});

test('AI involvement is reported from the author set, and bots do not count as human', () => {
  assert.equal(aiInvolvementFor(new Set([OWNER]), SETS), 'NO_AI_AUTHOR_RECORDED');
  assert.equal(aiInvolvementFor(new Set([OWNER, AI]), SETS), 'DECLARED_AI_ASSISTED_WITH_HUMAN_AUTHORSHIP');
  assert.equal(aiInvolvementFor(new Set([AI]), SETS), 'DECLARED_AI_AUTHORED_NO_HUMAN_AUTHOR_IN_SET');
  assert.equal(aiInvolvementFor(new Set([AI, BOT]), SETS), 'DECLARED_AI_AUTHORED_NO_HUMAN_AUTHOR_IN_SET');
});

test('a register that cannot be trusted yields defects instead of silent permissiveness', () => {
  const cases = [
    ['UNSUPPORTED_SCHEMA_VERSION', { schemaVersion: 2, identities: [] }],
    ['DOCUMENT_NOT_AN_OBJECT', null],
    ['UNSUPPORTED_RIGHTS_STATUS', register([{ contributorClass: 'X', emails: ['x@e.test'], rightsStatus: 'PROBABLY_FINE' }])],
    ['RESOLVED_WITHOUT_RIGHTS_BASIS', register([{ contributorClass: 'X', emails: ['x@e.test'], rightsStatus: 'RESOLVED', rightsBasis: '' }])],
    ['NO_EMAILS', register([{ contributorClass: 'X', emails: [], rightsStatus: 'RESOLVED', rightsBasis: 'SOMETHING' }])],
    ['DUPLICATE_EMAIL', register([{ contributorClass: 'X', emails: [OWNER], rightsStatus: 'RESOLVED', rightsBasis: 'SOMETHING' }])],
  ];
  for (const [expected, document] of cases) {
    const { defects } = parseRightsRegister(document);
    assert(defects.some((defect) => defect.startsWith(expected)), `${expected} not reported, got ${JSON.stringify(defects)}`);
  }
});

test('the committed register parses cleanly and still records an unresolved identity', () => {
  const document = JSON.parse(readFileSync('docs/ip/contributor-rights-register.json', 'utf8'));
  const { byEmail, defects } = parseRightsRegister(document);
  assert.deepEqual(defects, []);
  const live = rightsSets(byEmail);
  assert(live.resolved.size > 0);
  assert(live.unresolved.size > 0, 'an all-resolved register would make the gate vacuous');
});

// --- de minimis residue tier ---------------------------------------------

const deminimisSets = rightsSets(
  parseRightsRegister({
    schemaVersion: 1,
    identities: [
      {
        contributorClass: 'OWNER',
        rightsStatus: 'RESOLVED',
        rightsBasis: 'PRINCIPAL_AUTHOR',
        emails: ['owner@example.com'],
      },
      {
        contributorClass: 'UNATTRIBUTED_SERVER_IDENTITY',
        rightsStatus: 'UNRESOLVED',
        emails: ['root@server.local'],
      },
    ],
  }).byEmail,
);

const touched = new Set(['owner@example.com', 'root@server.local']);
const survives = () => new Set(['owner@example.com', 'root@server.local']);

test('surviving lines from an unresolved address still block when no de minimis accessor is supplied', () => {
  assert.equal(evaluateRights(touched, survives, deminimisSets), null);
});

test('surviving lines from an unresolved address still block when the adjudication fails', () => {
  const rejecting = () => ({ ok: false, detail: 'line 12 carries real logic' });
  assert.equal(evaluateRights(touched, survives, deminimisSets, rejecting), null);
});

test('a de minimis accessor returning a non-verdict does not clear the file', () => {
  assert.equal(evaluateRights(touched, survives, deminimisSets, () => null), null);
  assert.equal(evaluateRights(touched, survives, deminimisSets, () => true), null);
  assert.equal(evaluateRights(touched, survives, deminimisSets, () => ({ ok: 'yes' })), null);
});

test('a verified de minimis residue clears the file under its own tier', () => {
  const accepting = () => ({ ok: true, detail: '2 surviving line(s) carry no expression' });
  const evidence = evaluateRights(touched, survives, deminimisSets, accepting);
  assert.ok(evidence, 'a verified residue must produce evidence');
  assert.equal(evidence.tier, 'DE_MINIMIS_RESIDUE');
  assert.match(evidence.detail, /root@server\.local/);
  assert.match(evidence.detail, /carry no expression/);
});

test('the de minimis accessor is only consulted about the offending addresses', () => {
  let seen = null;
  const accepting = (emails) => {
    seen = emails;
    return { ok: true, detail: 'ok' };
  };
  evaluateRights(touched, survives, deminimisSets, accepting);
  assert.deepEqual(seen, ['root@server.local']);
});

test('a file with no unresolved author never consults the de minimis accessor', () => {
  let called = false;
  const spy = () => {
    called = true;
    return { ok: true, detail: 'ok' };
  };
  const clean = new Set(['owner@example.com']);
  const evidence = evaluateRights(clean, () => new Set(['owner@example.com']), deminimisSets, spy);
  assert.equal(evidence.tier, 'TOUCH_HISTORY');
  assert.equal(called, false, 'de minimis must never be consulted for an already-clean file');
});
