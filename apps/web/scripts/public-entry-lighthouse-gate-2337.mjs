import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.env.LIGHTHOUSE_DIR || '../../artifacts/public-entry-lcp-evidence-2337/local-production/lighthouse');
const reports = fs.existsSync(dir)
  ? fs.readdirSync(dir)
      .filter((name) => name.endsWith('.json') && name !== 'summary.json')
      .map((name) => {
        const report = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        return {
          file: name,
          finalUrl: report.finalUrl,
          scores: Object.fromEntries(
            Object.entries(report.categories).map(([key, value]) => [key, Math.round((value.score || 0) * 100)]),
          ),
          metrics: {
            firstContentfulPaintMs: report.audits['first-contentful-paint']?.numericValue,
            largestContentfulPaintMs: report.audits['largest-contentful-paint']?.numericValue,
            totalBlockingTimeMs: report.audits['total-blocking-time']?.numericValue,
            cumulativeLayoutShift: report.audits['cumulative-layout-shift']?.numericValue,
            speedIndexMs: report.audits['speed-index']?.numericValue,
          },
          renderBlocking:
            report.audits['render-blocking-resources']?.details?.items?.map((item) => ({
              url: item.url,
              totalBytes: item.totalBytes,
              wastedMs: item.wastedMs,
            })) ?? [],
          lcpElement:
            report.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.selector ?? null,
        };
      })
  : [];

const failures = [];
if (reports.length !== 3) failures.push(`expected 3 Lighthouse reports, got ${reports.length}`);
for (const report of reports) {
  const landing = report.file === 'platform-v7.json';
  if ((report.scores.performance || 0) < 80) failures.push(`${report.file}: performance ${report.scores.performance}`);
  if ((report.scores.accessibility || 0) < 95) failures.push(`${report.file}: accessibility ${report.scores.accessibility}`);
  if ((report.scores['best-practices'] || 0) < 90) failures.push(`${report.file}: best-practices ${report.scores['best-practices']}`);
  if (landing && (report.scores.seo || 0) < 90) failures.push(`${report.file}: SEO ${report.scores.seo}`);
  if (!(report.metrics.largestContentfulPaintMs <= 2500)) failures.push(`${report.file}: LCP ${report.metrics.largestContentfulPaintMs}`);
  if (!(report.metrics.totalBlockingTimeMs <= 200)) failures.push(`${report.file}: TBT ${report.metrics.totalBlockingTimeMs}`);
  if (!(report.metrics.cumulativeLayoutShift <= 0.1)) failures.push(`${report.file}: CLS ${report.metrics.cumulativeLayoutShift}`);
}

const summary = {
  status: failures.length ? 'failed' : 'passed',
  source: 'local-next-production',
  generatedAt: new Date().toISOString(),
  reports,
  failures,
};
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exit(1);
