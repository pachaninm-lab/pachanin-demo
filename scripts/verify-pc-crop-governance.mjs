import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'docs/platform-v7/crop-platform');
const BASELINE = '6f074942b46e226982e646c6f688886504b712ce';
const EXPECTED_EPICS = Array.from({ length: 24 }, (_, index) => `PC-CROP-${String(index).padStart(2, '0')}`);

function readJson(name) {
  return JSON.parse(readFileSync(resolve(ROOT, name), 'utf8'));
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function unique(values, label) {
  const seen = new Set();
  for (const value of values) {
    assert(!seen.has(value), `${label}: duplicate ${value}`);
    seen.add(value);
  }
  return seen;
}
function verifyAcyclic(epicsById) {
  const visiting = new Set();
  const visited = new Set();
  function visit(id, path = []) {
    if (visited.has(id)) return;
    assert(!visiting.has(id), `dependency cycle: ${[...path, id].join(' -> ')}`);
    visiting.add(id);
    const epic = epicsById.get(id);
    assert(epic, `unknown epic ${id}`);
    for (const dependency of epic.dependencies) visit(dependency, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of epicsById.keys()) visit(id);
}

const sources = readJson('source-registry.v1.json');
const requirements = readJson('requirements.v1.json');
const gaps = readJson('gap-map.v1.json');
const plan = readJson('implementation-plan.v1.json');
const ux = readJson('ux-screen-map.v1.json');
const acceptance = readJson('pc-crop-acceptance.schema.json');
const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
const uxContract = readFileSync(resolve(ROOT, 'UX-CONTRACT.md'), 'utf8');
const adr = readFileSync(resolve(ROOT, 'ADR-001-commodity-profile-and-deal-state.md'), 'utf8');

for (const [label, value] of [
  ['source registry', sources.exact_main_baseline],
  ['requirements registry', requirements.exact_main_baseline],
  ['gap map', gaps.exact_main_baseline],
  ['implementation plan', plan.exact_main_baseline],
]) assert(value === BASELINE, `${label}: baseline drift ${value}`);

assert(sources.production_operational_status === 'NOT_ATTESTED', 'source registry must remain NOT_ATTESTED');
assert(plan.production_operational_status === 'NOT_ATTESTED', 'plan must remain NOT_ATTESTED');
assert(requirements.maturity_boundary === 'TARGET_ARCHITECTURE_NOT_PRODUCTION_EVIDENCE', 'requirements maturity boundary drift');

const sourceIds = unique(sources.sources.map((source) => source.source_id), 'source registry');
assert(sourceIds.has('S-TZ-001'), 'missing pinned TЗ source');
assert(sourceIds.has('S-CODE-001'), 'missing exact code source');

unique(requirements.requirements.map((requirement) => requirement.id), 'requirements');
for (const requirement of requirements.requirements) {
  assert(sourceIds.has(requirement.source), `${requirement.id}: unknown source ${requirement.source}`);
  assert(Array.isArray(requirement.acceptance) && requirement.acceptance.length > 0, `${requirement.id}: empty acceptance`);
}

const allowedGapStatuses = new Set(gaps.classification);
for (const finding of gaps.findings) {
  assert(allowedGapStatuses.has(finding.status), `${finding.area}: invalid gap status ${finding.status}`);
  assert(typeof finding.finding === 'string' && finding.finding.length >= 20, `${finding.area}: weak finding`);
}

const epicIds = unique(plan.epics.map((epic) => epic.epic_id), 'implementation plan');
assert(epicIds.size === EXPECTED_EPICS.length, `expected ${EXPECTED_EPICS.length} epics, got ${epicIds.size}`);
for (const expected of EXPECTED_EPICS) assert(epicIds.has(expected), `missing ${expected}`);
const epicsById = new Map(plan.epics.map((epic) => [epic.epic_id, epic]));
for (const epic of plan.epics) for (const dependency of epic.dependencies) assert(epicIds.has(dependency), `${epic.epic_id}: unknown dependency ${dependency}`);
verifyAcyclic(epicsById);
assert(epicsById.get('PC-CROP-00').status === 'IN_PROGRESS', 'PC-CROP-00 must be IN_PROGRESS before acceptance');
assert(plan.execution_policy.fake_live_forbidden === true, 'fake-live prohibition missing');

for (const state of ['LOADING','EMPTY','READY','BLOCKED','PENDING_EXTERNAL','OFFLINE','SYNC_CONFLICT','PERMISSION_DENIED','SUCCEEDED']) {
  assert(ux.mandatory_ui_states.includes(state), `UX state missing: ${state}`);
}
assert(ux.principle === 'INTENT_FIRST_NOT_MODULE_FIRST', 'UX principle drift');
assert(ux.accessibility === 'WCAG_2_2_AA', 'accessibility target drift');
assert(ux.locales.join(',') === 'ru,en,zh', 'locale contract drift');

assert(acceptance.properties?.status?.enum?.includes('NOT_RUN'), 'acceptance schema must support NOT_RUN');
assert(acceptance.properties?.revision_kind?.enum?.includes('EXACT_HEAD'), 'acceptance schema missing EXACT_HEAD');
assert(acceptance.properties?.revision_kind?.enum?.includes('EXACT_MAIN'), 'acceptance schema missing EXACT_MAIN');
assert(readme.includes(BASELINE), 'README baseline missing');
assert(readme.includes('NOT_ATTESTED'), 'README maturity boundary missing');
assert(uxContract.includes('Review → impact → prerequisites → confirmation → server result → immutable receipt'), 'critical action UX flow missing');
assert(adr.includes('parallel Deal state dimensions'), 'ADR decision title missing');
assert(adr.includes('Versioned registry'), 'ADR commodity decision missing');

console.log(JSON.stringify({
  status: 'PASS', baseline: BASELINE, sources: sourceIds.size,
  requirements: requirements.requirements.length, gaps: gaps.findings.length,
  epics: epicIds.size, screens: ux.screens.length, maturity: plan.production_operational_status,
}, null, 2));
