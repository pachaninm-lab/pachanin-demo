import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sbomDir = process.argv[2] ?? 'artifacts/ip-clean-room/sbom';
const outDir = process.argv[3] ?? 'artifacts/ip-clean-room';
const overridesPath = process.argv[4] ?? 'docs/ip/third-party-license-overrides.json';
mkdirSync(outDir, { recursive: true });

function csv(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function licenseString(component) {
  const values = [];
  for (const entry of component.licenses ?? []) {
    if (entry.expression) values.push(entry.expression);
    if (entry.license?.id) values.push(entry.license.id);
    else if (entry.license?.name) values.push(entry.license.name);
  }
  return [...new Set(values)].join(' OR ') || 'UNKNOWN';
}

function propertyMap(component) {
  return new Map((component.properties ?? []).map((item) => [item.name, item.value]));
}

function dependencyScope(component) {
  const props = propertyMap(component);
  if (props.get('cdx:npm:package:development') === 'true') return 'DEV';
  if (component.scope === 'optional') return 'OPTIONAL';
  if (component.scope === 'excluded') return 'EXCLUDED';
  return 'RUNTIME_OR_REQUIRED';
}

const blockedRe = /(^|\W)(AGPL(?:-\d(?:\.\d)?)?|GPL(?:-\d(?:\.\d)?)?|SSPL(?:-\d(?:\.\d)?)?|BUSL(?:-\d(?:\.\d)?))(\W|$)/i;
const reviewRe = /(^|\W)(LGPL|MPL|EPL|CDDL|CPL|OSL|EUPL|CC-BY|CC-BY-SA|PolyForm|Commons-Clause)(\W|$)/i;
const permissiveRe = /(^|\W)(MIT|MIT\/X11|Apache-2\.0|ISC|BSD-2-Clause|BSD-3-Clause|0BSD|Zlib|Unlicense|CC0-1\.0|OFL-1\.1|Python-2\.0|PSF-2\.0|BlueOak-1\.0\.0)(\W|$)/i;

function stripOuterParens(value) {
  let out = value.trim();
  while (out.startsWith('(') && out.endsWith(')')) out = out.slice(1, -1).trim();
  return out;
}

function classifyConjunction(expression) {
  const parts = stripOuterParens(expression).split(/\s+AND\s+/i).map(stripOuterParens);
  if (parts.some((part) => blockedRe.test(part))) return 'BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE';
  if (parts.some((part) => reviewRe.test(part))) return 'LEGAL_REVIEW';
  if (parts.length && parts.every((part) => permissiveRe.test(part))) return 'PERMISSIVE_OR_APPROVED';
  return 'UNKNOWN_REVIEW';
}

function classifyExpression(license) {
  if (!license || license === 'UNKNOWN') return 'UNKNOWN_REVIEW';
  const alternatives = stripOuterParens(license).split(/\s+OR\s+/i).map(stripOuterParens);
  if (alternatives.length > 1) {
    const classes = alternatives.map(classifyConjunction);
    if (classes.includes('PERMISSIVE_OR_APPROVED')) return 'PERMISSIVE_OR_APPROVED_DUAL_LICENSE';
    if (classes.includes('LEGAL_REVIEW')) return 'LEGAL_REVIEW';
    if (classes.every((value) => value === 'BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE')) {
      return 'BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE';
    }
    return 'UNKNOWN_REVIEW';
  }
  return classifyConjunction(license);
}

function isInternal(component) {
  const purl = component.purl ?? '';
  const name = component.name ?? '';
  return purl === 'pkg:pypi/transparent-agro-intelligence@0.1.0'
    || name === 'transparent-agro-intelligence'
    || name === 'prozrachnaya-cena-runtime'
    || name.startsWith('@pc/')
    || name.startsWith('@pachanin/');
}

const overrides = new Map();
if (existsSync(overridesPath)) {
  const parsed = JSON.parse(readFileSync(overridesPath, 'utf8'));
  for (const item of parsed.overrides ?? []) overrides.set(item.purl, item);
}

if (!existsSync(sbomDir)) throw new Error(`SBOM directory not found: ${sbomDir}`);
const sbomFiles = readdirSync(sbomDir).filter((name) => name.endsWith('.cdx.json')).sort();
if (!sbomFiles.length) throw new Error(`No CycloneDX JSON files found in ${sbomDir}`);

const byKey = new Map();
for (const file of sbomFiles) {
  const bom = JSON.parse(readFileSync(join(sbomDir, file), 'utf8'));
  for (const component of bom.components ?? []) {
    const detectedLicense = licenseString(component);
    const purl = component.purl ?? '';
    const key = `${component.name ?? ''}\u0000${component.version ?? ''}\u0000${purl}`;
    const props = propertyMap(component);
    const item = byKey.get(key) ?? {
      name: component.name ?? '',
      version: component.version ?? '',
      purl,
      type: component.type ?? '',
      licenses: new Set(),
      scopes: new Set(),
      workspaces: new Set(),
      sources: new Set(),
      internal: isInternal(component),
    };
    item.licenses.add(detectedLicense);
    item.scopes.add(dependencyScope(component));
    const workspace = props.get('internal:workspaceRef');
    if (workspace) item.workspaces.add(workspace);
    item.sources.add(file);
    byKey.set(key, item);
  }
}

const rows = [...byKey.values()].map((item) => {
  const detectedLicense = [...item.licenses].sort().join(' OR ');
  const override = overrides.get(item.purl);
  let license = detectedLicense;
  let electedLicense = '';
  let classification = classifyExpression(detectedLicense);
  let evidence = '';

  if (item.internal) {
    license = 'Proprietary / UNLICENSED';
    classification = 'INTERNAL_PROPRIETARY';
    evidence = 'Repository proprietary policy';
  } else if (override) {
    license = override.declaredLicense ?? detectedLicense;
    electedLicense = override.electedLicense ?? '';
    classification = override.classification ?? classifyExpression(electedLicense || license);
    evidence = override.evidenceUrl ?? '';
  }

  return {
    name: item.name,
    version: item.version,
    purl: item.purl,
    type: item.type,
    dependencyScope: [...item.scopes].sort().join(';'),
    workspaces: [...item.workspaces].sort().join(';'),
    detectedLicense,
    license,
    electedLicense,
    classification,
    evidence,
    sbomSources: [...item.sources].sort().join(';'),
  };
}).sort((a, b) => a.purl.localeCompare(b.purl) || a.version.localeCompare(b.version));

const summary = rows.reduce((acc, row) => {
  acc[row.classification] = (acc[row.classification] ?? 0) + 1;
  return acc;
}, {});
const scopeSummary = rows.reduce((acc, row) => {
  acc[row.dependencyScope] = (acc[row.dependencyScope] ?? 0) + 1;
  return acc;
}, {});

writeFileSync(join(outDir, 'license-map.csv'), [
  'component,version,purl,type,dependency_scope,workspaces,detected_license,resolved_license,elected_license,classification,evidence,sbom_sources',
  ...rows.map((r) => [
    r.name, r.version, r.purl, r.type, r.dependencyScope, r.workspaces,
    r.detectedLicense, r.license, r.electedLicense, r.classification, r.evidence, r.sbomSources,
  ].map(csv).join(',')),
].join('\n') + '\n');

writeFileSync(join(outDir, 'license-summary.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  sbomFiles: sbomFiles.map((name) => name),
  components: rows.length,
  classifications: summary,
  dependencyScopes: scopeSummary,
  overridesApplied: rows.filter((row) => overrides.has(row.purl)).length,
  policy: {
    blocked: 'A required AGPL/GPL/SSPL/BUSL-only expression is blocked pending explicit legal approval. Dual-license OR expressions are evaluated by the elected/available permissive branch.',
    review: 'Weak copyleft, attribution-heavy, custom and unresolved licenses remain explicit review items; they are not silently treated as proprietary code.',
    internal: 'Internal workspace/application components are classified as Proprietary / UNLICENSED and excluded from third-party OSS risk counts.',
  },
}, null, 2) + '\n');

if ((summary.BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE ?? 0) > 0) {
  console.error('Blocked license candidates detected. See license-map.csv.');
  process.exitCode = 2;
}
console.log(`License map written: ${rows.length} unique components; ${overrides.size} reviewed override(s) available`);
