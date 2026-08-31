import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { classifyLicenseExpression } from './license-expression-policy.mjs';

const sbomDir = process.argv[2] ?? 'artifacts/ip-clean-room/sbom';
const outDir = process.argv[3] ?? 'artifacts/ip-clean-room';
const overridesPath = process.argv[4] ?? 'docs/ip/third-party-license-overrides.json';
mkdirSync(outDir, { recursive: true });
if (!lstatSync(outDir).isDirectory()) throw new Error(`License output path is not a real directory: ${outDir}`);

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

function canonicalManifestPath(value) {
  const path = String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//u, '');
  if (!path || path.startsWith('/') || /^[A-Za-z]:\//u.test(path)) return '';
  if (path.split('/').includes('..')) return '';
  return path;
}

const manifestCache = new Map();
function readInternalManifest(path) {
  if (manifestCache.has(path)) return manifestCache.get(path);

  let record = null;
  const packageManifest = path === 'package.json' || /^(?:apps|packages)\/[^/]+\/package\.json$/u.test(path);
  const pythonManifest = path === 'apps/tai/pyproject.toml';
  if ((packageManifest || pythonManifest) && existsSync(path) && lstatSync(path).isFile()) {
    if (packageManifest) {
      const manifest = JSON.parse(readFileSync(path, 'utf8'));
      if (manifest.private === true && manifest.name) {
        record = { name: String(manifest.name), version: String(manifest.version ?? '') };
      }
    } else {
      const source = readFileSync(path, 'utf8');
      const marker = source.match(/^\[project\][ \t]*\r?$/mu);
      const tail = marker ? source.slice((marker.index ?? 0) + marker[0].length) : '';
      const nextSection = tail.search(/^\[[^\r\n]+\][ \t]*\r?$/mu);
      const project = nextSection >= 0 ? tail.slice(0, nextSection) : tail;
      const name = project.match(/^name\s*=\s*["']([^"']+)["']\s*$/mu)?.[1] ?? '';
      const version = project.match(/^version\s*=\s*["']([^"']+)["']\s*$/mu)?.[1] ?? '';
      if (name && version) record = { name, version };
    }
  }

  manifestCache.set(path, record);
  return record;
}

function internalManifestEvidence(component) {
  const props = propertyMap(component);
  const path = canonicalManifestPath(props.get('SrcFile'));
  if (!path) return '';
  const manifest = readInternalManifest(path);
  if (!manifest) return '';
  if (manifest.name !== String(component.name ?? '')) return '';
  if (manifest.version !== String(component.version ?? '')) return '';
  return path;
}

const overrides = new Map();
if (existsSync(overridesPath)) {
  if (!lstatSync(overridesPath).isFile()) throw new Error(`License override path is not a regular file: ${overridesPath}`);
  const parsed = JSON.parse(readFileSync(overridesPath, 'utf8'));
  for (const item of parsed.overrides ?? []) overrides.set(item.purl, item);
}

if (!existsSync(sbomDir) || !lstatSync(sbomDir).isDirectory()) throw new Error(`SBOM directory not found or not a real directory: ${sbomDir}`);
const sbomFiles = readdirSync(sbomDir).filter((name) => name.endsWith('.cdx.json')).sort();
if (!sbomFiles.length) throw new Error(`No CycloneDX JSON files found in ${sbomDir}`);

const byKey = new Map();
for (const file of sbomFiles) {
  const sbomPath = join(sbomDir, file);
  if (!lstatSync(sbomPath).isFile()) throw new Error(`SBOM input is not a regular file: ${sbomPath}`);
  const bom = JSON.parse(readFileSync(sbomPath, 'utf8'));
  for (const component of bom.components ?? []) {
    const detectedLicense = licenseString(component);
    const purl = component.purl ?? '';
    const internalManifest = internalManifestEvidence(component);
    const key = `${component.name ?? ''}\u0000${component.version ?? ''}\u0000${purl}\u0000${internalManifest || 'EXTERNAL'}`;
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
      internalManifest,
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
  let classification = classifyLicenseExpression(detectedLicense);
  let evidence = '';

  if (item.internalManifest) {
    license = 'Proprietary / UNLICENSED';
    classification = 'INTERNAL_PROPRIETARY';
    evidence = `Repository internal manifest: ${item.internalManifest}`;
  } else if (override) {
    license = override.declaredLicense ?? detectedLicense;
    electedLicense = override.electedLicense ?? '';
    classification = override.classification ?? classifyLicenseExpression(electedLicense || license);
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
  internalComponents: rows.filter((row) => row.classification === 'INTERNAL_PROPRIETARY').length,
  internalEvidenceMode: 'SBOM_SRCFILE_TO_EXACT_REPOSITORY_MANIFEST',
  classifications: summary,
  dependencyScopes: scopeSummary,
  overridesApplied: rows.filter((row) => overrides.has(row.purl)).length,
  policy: {
    blocked: 'A required AGPL/GPL/SSPL/BUSL-only expression is blocked pending explicit legal approval. Dual-license OR expressions are evaluated by the elected/available permissive branch.',
    review: 'Weak copyleft, attribution-heavy, custom and unresolved licenses remain explicit review items; they are not silently treated as proprietary code.',
    internal: 'A component is internal only when its SBOM SrcFile identifies an approved repository manifest whose private/name/version metadata matches exactly. Name prefixes alone never establish first-party origin.',
  },
}, null, 2) + '\n');

if ((summary.BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE ?? 0) > 0) {
  console.error('Blocked license candidates detected. See license-map.csv.');
  process.exitCode = 2;
}
console.log(`License map written: ${rows.length} unique components; ${overrides.size} reviewed override(s) available`);
