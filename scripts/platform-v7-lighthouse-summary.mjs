#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function readArg(name, fallback = '') {
  const prefix = `--${name}=`;
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length) || fallback;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

function score(report, category) {
  const value = report.categories?.[category]?.score;
  return typeof value === 'number' ? Math.round(value * 100) : null;
}

function metric(report, audit) {
  const value = report.audits?.[audit]?.numericValue;
  return typeof value === 'number' ? Math.round(value * 100) / 100 : null;
}

function median(values) {
  const clean = values.filter((value) => typeof value === 'number').sort((left, right) => left - right);
  if (clean.length === 0) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? Math.round(((clean[middle - 1] + clean[middle]) / 2) * 100) / 100 : clean[middle];
}

const input = path.resolve(readArg('input', 'apps/web/lighthouseci-artifacts/mobile'));
const output = path.resolve(readArg('output', 'apps/web/lighthouseci-artifacts/lighthouse-summary.json'));
const mode = readArg('mode', path.basename(input));

let candidates;
try {
  candidates = (await walk(input)).filter((file) => file.endsWith('.json'));
} catch (error) {
  throw new Error(`Lighthouse evidence directory is unavailable: ${input} (${error.message})`);
}

const reports = [];
for (const file of candidates) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    continue;
  }
  if (!parsed.categories || !parsed.audits || !parsed.finalUrl) continue;
  reports.push({
    file: path.relative(process.cwd(), file),
    requestedUrl: parsed.requestedUrl,
    finalUrl: parsed.finalUrl,
    fetchTime: parsed.fetchTime,
    categories: {
      performance: score(parsed, 'performance'),
      accessibility: score(parsed, 'accessibility'),
      bestPractices: score(parsed, 'best-practices'),
      seo: score(parsed, 'seo'),
    },
    metrics: {
      firstContentfulPaintMs: metric(parsed, 'first-contentful-paint'),
      largestContentfulPaintMs: metric(parsed, 'largest-contentful-paint'),
      totalBlockingTimeMs: metric(parsed, 'total-blocking-time'),
      cumulativeLayoutShift: metric(parsed, 'cumulative-layout-shift'),
      speedIndexMs: metric(parsed, 'speed-index'),
    },
  });
}

if (reports.length === 0) {
  throw new Error(`No Lighthouse report JSON files found under ${input}`);
}

const summary = {
  schemaVersion: 1,
  mode,
  source: 'local-production-build',
  productionEvidence: false,
  reportCount: reports.length,
  medians: {
    categories: {
      performance: median(reports.map((report) => report.categories.performance)),
      accessibility: median(reports.map((report) => report.categories.accessibility)),
      bestPractices: median(reports.map((report) => report.categories.bestPractices)),
      seo: median(reports.map((report) => report.categories.seo)),
    },
    metrics: {
      firstContentfulPaintMs: median(reports.map((report) => report.metrics.firstContentfulPaintMs)),
      largestContentfulPaintMs: median(reports.map((report) => report.metrics.largestContentfulPaintMs)),
      totalBlockingTimeMs: median(reports.map((report) => report.metrics.totalBlockingTimeMs)),
      cumulativeLayoutShift: median(reports.map((report) => report.metrics.cumulativeLayoutShift)),
      speedIndexMs: median(reports.map((report) => report.metrics.speedIndexMs)),
    },
  },
  reports,
};

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

const categories = summary.medians.categories;
const metrics = summary.medians.metrics;
const markdown = [
  `## Platform V7 Lighthouse — ${mode}`,
  '',
  '- Evidence class: local production build; not live VPS evidence',
  `- Reports: ${summary.reportCount}`,
  `- Performance: ${categories.performance ?? 'n/a'}`,
  `- Accessibility: ${categories.accessibility ?? 'n/a'}`,
  `- Best practices: ${categories.bestPractices ?? 'n/a'}`,
  `- SEO: ${categories.seo ?? 'n/a'}`,
  `- FCP: ${metrics.firstContentfulPaintMs ?? 'n/a'} ms`,
  `- LCP: ${metrics.largestContentfulPaintMs ?? 'n/a'} ms`,
  `- TBT: ${metrics.totalBlockingTimeMs ?? 'n/a'} ms`,
  `- CLS: ${metrics.cumulativeLayoutShift ?? 'n/a'}`,
  '',
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, markdown, { encoding: 'utf8', flag: 'a' });
}
process.stdout.write(markdown);
