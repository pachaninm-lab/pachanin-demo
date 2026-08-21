import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const sbomDir = process.argv[2] ?? 'artifacts/ip-clean-room/sbom';
const outDir = process.argv[3] ?? 'artifacts/ip-clean-room';
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

const blockedRe = /(^|\W)(AGPL(?:-\d(?:\.\d)?)?|GPL(?:-\d(?:\.\d)?)?|SSPL(?:-\d(?:\.\d)?)?|BUSL(?:-\d(?:\.\d)?))(\W|$)/i;
const reviewRe = /(^|\W)(LGPL|MPL|EPL|CDDL|CPL|OSL|EUPL|CC-BY|CC-BY-SA|PolyForm|Commons-Clause)(\W|$)/i;
const permissiveRe = /(^|\W)(MIT|Apache-2\.0|ISC|BSD-2-Clause|BSD-3-Clause|0BSD|Zlib|Unlicense|CC0-1\.0|OFL-1\.1|Python-2\.0|PSF-2\.0|BlueOak-1\.0\.0)(\W|$)/i;

function classify(license) {
  if (!license || license === 'UNKNOWN') return 'UNKNOWN_REVIEW';
  if (blockedRe.test(license)) return 'BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE';
  if (reviewRe.test(license)) return 'LEGAL_REVIEW';
  if (permissiveRe.test(license)) return 'PERMISSIVE_OR_APPROVED';
  return 'UNKNOWN_REVIEW';
}

if (!existsSync(sbomDir)) throw new Error(`SBOM directory not found: ${sbomDir}`);
const sbomFiles = readdirSync(sbomDir).filter((name) => name.endsWith('.cdx.json')).sort();
if (!sbomFiles.length) throw new Error(`No CycloneDX JSON files found in ${sbomDir}`);

const byKey = new Map();
for (const file of sbomFiles) {
  const bom = JSON.parse(readFileSync(join(sbomDir, file), 'utf8'));
  for (const component of bom.components ?? []) {
    const license = licenseString(component);
    const purl = component.purl ?? '';
    const key = `${component.name ?? ''}\u0000${component.version ?? ''}\u0000${purl}`;
    const item = byKey.get(key) ?? {
      name: component.name ?? '', version: component.version ?? '', purl,
      type: component.type ?? '', licenses: new Set(), sources: new Set(),
    };
    item.licenses.add(license);
    item.sources.add(file);
    byKey.set(key, item);
  }
}

const rows = [...byKey.values()].map((item) => {
  const license = [...item.licenses].sort().join(' OR ');
  return {
    name: item.name,
    version: item.version,
    purl: item.purl,
    type: item.type,
    license,
    classification: classify(license),
    sbomSources: [...item.sources].sort().join(';'),
  };
}).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const summary = rows.reduce((acc, row) => {
  acc[row.classification] = (acc[row.classification] ?? 0) + 1;
  return acc;
}, {});

writeFileSync(join(outDir, 'license-map.csv'), [
  'component,version,purl,type,license,classification,sbom_sources',
  ...rows.map((r) => [r.name, r.version, r.purl, r.type, r.license, r.classification, r.sbomSources].map(csv).join(',')),
].join('\n') + '\n');

writeFileSync(join(outDir, 'license-summary.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  sbomFiles: sbomFiles.map(basename),
  components: rows.length,
  classifications: summary,
  policy: {
    blocked: 'AGPL/GPL/SSPL/BUSL candidates require removal or explicit legal approval before runtime use.',
    review: 'Weak copyleft, attribution-heavy, custom and unknown licenses require review; they are not presumed clean.',
  },
}, null, 2) + '\n');

if ((summary.BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE ?? 0) > 0) {
  console.error('Blocked license candidates detected. See license-map.csv.');
  process.exitCode = 2;
}
console.log(`License map written: ${rows.length} unique components`);
