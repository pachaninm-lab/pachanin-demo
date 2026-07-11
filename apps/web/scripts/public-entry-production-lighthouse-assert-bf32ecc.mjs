import fs from 'node:fs';
import path from 'node:path';

const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/public-entry-production-smoke-bf32ecc');
const pages = [
  { key: 'landing', file: 'lighthouse-landing.json', requireSeo: true },
  { key: 'login', file: 'lighthouse-login.json', requireSeo: false },
  { key: 'recovery', file: 'lighthouse-recovery.json', requireSeo: false },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const summary = [];
for (const page of pages) {
  const report = JSON.parse(fs.readFileSync(path.join(artifactDir, page.file), 'utf8'));
  const categories = report.categories;
  const audits = report.audits;
  const row = {
    page: page.key,
    performance: Math.round((categories.performance?.score ?? 0) * 100),
    accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((categories['best-practices']?.score ?? 0) * 100),
    seo: Math.round((categories.seo?.score ?? 0) * 100),
    lcpMs: Math.round(audits['largest-contentful-paint']?.numericValue ?? Number.POSITIVE_INFINITY),
    tbtMs: Math.round(audits['total-blocking-time']?.numericValue ?? Number.POSITIVE_INFINITY),
    cls: Number((audits['cumulative-layout-shift']?.numericValue ?? Number.POSITIVE_INFINITY).toFixed(4)),
  };
  assert(row.performance >= 95, `${page.key}: performance ${row.performance} < 95`);
  assert(row.accessibility >= 95, `${page.key}: accessibility ${row.accessibility} < 95`);
  assert(row.bestPractices >= 90, `${page.key}: best practices ${row.bestPractices} < 90`);
  if (page.requireSeo) assert(row.seo >= 90, `${page.key}: SEO ${row.seo} < 90`);
  assert(row.lcpMs <= 2500, `${page.key}: LCP ${row.lcpMs}ms > 2500ms`);
  assert(row.tbtMs <= 200, `${page.key}: TBT ${row.tbtMs}ms > 200ms`);
  assert(row.cls <= 0.1, `${page.key}: CLS ${row.cls} > 0.1`);
  summary.push(row);
}

fs.writeFileSync(path.join(artifactDir, 'lighthouse-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
