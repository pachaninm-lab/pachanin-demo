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

/**
 * Разрешение лицензии по установленному артефакту.
 *
 * cdxgen оставляет `licenses: null` у части компонентов — на этом дереве у 266
 * из 1193, и среди них next, react-dom, recharts, zustand, lucide-react и все
 * пакеты со скоупом. Карта честно писала UNKNOWN, но это ложный неизвестный:
 * лицензия объявлена в манифесте того самого пакета, который и поставляется.
 * Ложный UNKNOWN хуже пропуска — он делает 116 из 152 поставляемых компонентов
 * непроверяемыми и тем самым обесценивает всю карту.
 *
 * Источник здесь — не догадка и не таблица известных пакетов, а `package.json`
 * установленного артефакта. Происхождение записывается отдельной строкой
 * evidence, чтобы объявленное SBOM и снятое с диска никогда не смешивались.
 * Не нашли — остаётся UNKNOWN: отсутствие ответа лучше выдуманного.
 */
const PNPM_ROOT = 'node_modules/.pnpm';
const storeIndex = new Map();
let storeIndexed = false;

function indexInstalledStore() {
  if (storeIndexed) return;
  storeIndexed = true;
  if (!existsSync(PNPM_ROOT) || !lstatSync(PNPM_ROOT).isDirectory()) return;
  for (const entry of readdirSync(PNPM_ROOT)) {
    // <escaped-name>@<version>[_<peer suffix>]; у скоупа `/` заменён на `+`.
    const parsed = /^(@?[^@]+)@([^_]+)/u.exec(entry);
    if (!parsed) continue;
    const key = `${parsed[1]}@${parsed[2]}`;
    if (!storeIndex.has(key)) storeIndex.set(key, entry);
  }
}

function purlIdentity(purl) {
  const match = /^pkg:npm\/(.+)@([^@?#]+)(?:[?#].*)?$/u.exec(String(purl ?? ''));
  if (!match) return null;
  let name;
  try {
    name = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  if (!name || name.includes('..') || name.startsWith('/')) return null;
  return { name, version: decodeURIComponent(match[2]) };
}

function declaredLicenseOf(manifest) {
  const direct = manifest.license;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  if (direct && typeof direct === 'object' && typeof direct.type === 'string') return direct.type.trim();
  const legacy = Array.isArray(manifest.licenses) ? manifest.licenses : [];
  const values = legacy
    .map((entry) => (typeof entry === 'string' ? entry : entry?.type))
    .filter((value) => typeof value === 'string' && value.trim());
  return values.length ? [...new Set(values)].join(' OR ') : '';
}

const installedCache = new Map();
function installedManifestLicense(purl) {
  if (installedCache.has(purl)) return installedCache.get(purl);
  let resolved = null;
  const identity = purlIdentity(purl);
  if (identity) {
    indexInstalledStore();
    const dir = storeIndex.get(`${identity.name.replace('/', '+')}@${identity.version}`);
    const candidates = [];
    if (dir) candidates.push(join(PNPM_ROOT, dir, 'node_modules', identity.name, 'package.json'));
    candidates.push(join('node_modules', identity.name, 'package.json'));
    for (const path of candidates) {
      if (!existsSync(path) || !lstatSync(path).isFile()) continue;
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(path, 'utf8'));
      } catch {
        continue;
      }
      // Версия обязана совпасть: иначе это лицензия другого артефакта.
      if (String(manifest.version ?? '') !== identity.version) continue;
      const license = declaredLicenseOf(manifest);
      if (!license) continue;
      resolved = { license, path };
      break;
    }
  }
  installedCache.set(purl, resolved);
  return resolved;
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
      group: component.group ?? '',
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

  let installedEvidence = '';
  if (item.internalManifest) {
    license = 'Proprietary / UNLICENSED';
    classification = 'INTERNAL_PROPRIETARY';
    evidence = `Repository internal manifest: ${item.internalManifest}`;
  } else if (override) {
    license = override.declaredLicense ?? detectedLicense;
    electedLicense = override.electedLicense ?? '';
    classification = override.classification ?? classifyLicenseExpression(electedLicense || license);
    evidence = override.evidenceUrl ?? '';
  } else if (detectedLicense === 'UNKNOWN') {
    // SBOM не объявил ничего — спрашиваем сам поставляемый артефакт.
    const installed = installedManifestLicense(item.purl);
    if (installed) {
      license = installed.license;
      classification = classifyLicenseExpression(installed.license);
      evidence = `Installed package manifest: ${installed.path}`;
      installedEvidence = installed.path;
    }
  }

  return {
    name: item.group ? `${item.group}/${item.name}` : item.name,
    version: item.version,
    installedEvidence,
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
  licensesResolvedFromInstalledArtifact: rows.filter((row) => row.installedEvidence).length,
  unresolvedAfterInstalledLookup: rows.filter((row) => row.classification === 'UNKNOWN_REVIEW').length,
  classifications: summary,
  dependencyScopes: scopeSummary,
  overridesApplied: rows.filter((row) => overrides.has(row.purl)).length,
  policy: {
    blocked: 'A required AGPL/GPL/SSPL/BUSL-only expression is blocked pending explicit legal approval. Dual-license OR expressions are evaluated by the elected/available permissive branch.',
    review: 'Weak copyleft, attribution-heavy, custom and unresolved licenses remain explicit review items; they are not silently treated as proprietary code.',
    internal: 'A component is internal only when its SBOM SrcFile identifies an approved repository manifest whose private/name/version metadata matches exactly. Name prefixes alone never establish first-party origin.',
    installedArtifact: 'When the SBOM declares no license, the license is read from the installed package manifest the build actually ships, and the evidence column names that exact path. The version must match the component version. Nothing is inferred from a package name, and a component that cannot be resolved stays UNKNOWN_REVIEW rather than being guessed.',
  },
}, null, 2) + '\n');

if ((summary.BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE ?? 0) > 0) {
  console.error('Blocked license candidates detected. See license-map.csv.');
  process.exitCode = 2;
}
console.log(`License map written: ${rows.length} unique components; ${overrides.size} reviewed override(s) available`);
