import fs from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-industrial-evidence-2345');
const targets = [
  { key: 'landing', file: 'lighthouse-landing.json', seoRequired: true },
  { key: 'login', file: 'lighthouse-login.json', seoRequired: false },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const results = [];
for (const target of targets) {
  const report = JSON.parse(await fs.readFile(path.join(OUT, target.file), 'utf8'));
  const categories = report.categories || {};
  const audits = report.audits || {};
  const score = (key) => Math.round((categories[key]?.score ?? 0) * 100);
  const metrics = {
    performance: score('performance'),
    accessibility: score('accessibility'),
    bestPractices: score('best-practices'),
    seo: score('seo'),
    lcpMs: audits['largest-contentful-paint']?.numericValue ?? Number.POSITIVE_INFINITY,
    tbtMs: audits['total-blocking-time']?.numericValue ?? Number.POSITIVE_INFINITY,
    cls: audits['cumulative-layout-shift']?.numericValue ?? Number.POSITIVE_INFINITY,
    fcpMs: audits['first-contentful-paint']?.numericValue ?? Number.POSITIVE_INFINITY,
  };

  assert(metrics.performance >= 95, `${target.key}: performance ${metrics.performance} < 95`);
  assert(metrics.accessibility >= 95, `${target.key}: accessibility ${metrics.accessibility} < 95`);
  assert(metrics.bestPractices >= 90, `${target.key}: best practices ${metrics.bestPractices} < 90`);
  if (target.seoRequired) assert(metrics.seo >= 90, `${target.key}: SEO ${metrics.seo} < 90`);
  assert(metrics.lcpMs <= 2500, `${target.key}: LCP ${metrics.lcpMs}ms > 2500ms`);
  assert(metrics.tbtMs <= 200, `${target.key}: TBT ${metrics.tbtMs}ms > 200ms`);
  assert(metrics.cls <= 0.1, `${target.key}: CLS ${metrics.cls} > 0.1`);
  results.push({ key: target.key, ...metrics });
}

const summary = {
  generatedAt: new Date().toISOString(),
  implementation: process.env.IMPLEMENTATION_SHA || null,
  deployId: process.env.DEPLOY_ID || null,
  results,
};
await fs.writeFile(path.join(OUT, 'lighthouse-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
