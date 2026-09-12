#!/usr/bin/env node
/**
 * Пофайловая атрибуция AI по всей истории.
 *
 * AI_ASSISTED_PROVENANCE.md объявлял это неустановленным и опирался на
 * declared-origin — 30 файлов из 6178. Это отвечало на вопрос «сколько файлов
 * несут объявление», а не на вопрос «чего касался инструмент».
 *
 * Здесь считается второе: для каждого отслеживаемого файла берётся множество
 * личностей-авторов по всей истории, и файл относится к одному из классов.
 * Классификация по критичности берётся из proprietary-core-boundary.json тем
 * же правилом, что в build-ip-clean-room.mjs — иначе в программе завелись бы
 * два несогласованных счёта файлов ядра.
 *
 * ЧТО ЭТО НЕ ЗНАЧИТ. Авторство коммита не равно авторству содержимого. Файл,
 * закоммиченный под личностью инструмента, создан по спецификации владельца.
 * Замер даёт масштаб, а не вывод о том, кому принадлежит замысел.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room';
const boundaryPath = process.argv[3] ?? 'docs/ip/proprietary-core-boundary.json';

/** Личности инструментов. Список закрытый: новый инструмент обязан быть добавлен осознанно. */
export const AI_IDENTITIES = Object.freeze([
  'Claude#cd29c5ac348a026a',
  'Codex#b1b6016d8905655b',
  'claude[bot]#a77c9bb540d3b078',
]);

/**
 * Автоматические учётные записи. Они не авторы: права в том, что они
 * закоммитили, следуют за тем, кто их направил.
 */
export const AUTOMATION_NAMES = Object.freeze([
  'github-actions[bot]', 'platform-v7-agent', 'platform-v7-ops', 'p7-state',
  'pc-crop-governed-bot', 'pc-crop-governance-bot', 'public-entry-watch', 'dependabot[bot]',
  'p7-authority-bot', 'pc-crop-authority[bot]', 'pc-crop-auth-mail-checker',
  'pc-crop-auth-mail-fix', 'platform-v7-industrial-bot', 'root',
]);

/** Тот же расчёт, что в build-ip-clean-room.mjs. */
export function contributorId(name, email) {
  const cleanName = String(name || 'UNKNOWN').replace(/\s+/g, ' ').trim() || 'UNKNOWN';
  const emailHash = createHash('sha256').update(String(email || 'UNKNOWN').trim().toLowerCase()).digest('hex').slice(0, 16);
  return `${cleanName}#${emailHash}`;
}

/**
 * Класс файла по множеству коснувшихся его личностей.
 *
 * AI_ONLY означает «в истории нет ни одного человека, кроме инструментов и
 * автоматики», а не «человек не участвовал»: спецификация в git не хранится.
 */
export function classifyTouch(identities, { ai = AI_IDENTITIES, automation = AUTOMATION_NAMES } = {}) {
  const aiSet = new Set(ai);
  const automationSet = new Set(automation);
  const list = [...(identities ?? [])];
  if (list.length === 0) return 'NO_HISTORY';
  const hasAi = list.some((identity) => aiSet.has(identity));
  const hasHuman = list.some((identity) => !aiSet.has(identity) && !automationSet.has(identity.slice(0, identity.lastIndexOf('#'))));
  if (hasAi && hasHuman) return 'AI_AND_HUMAN';
  if (hasAi) return 'AI_ONLY';
  if (hasHuman) return 'HUMAN_ONLY';
  return 'AUTOMATION_ONLY';
}

/** Критичность пути. Правило совпадения — как в build-ip-clean-room.mjs. */
export function criticalityFor(path, protectedRoots) {
  for (const root of protectedRoots ?? []) {
    if (path === root.path || path.startsWith(`${root.path}/`)) return root.criticality || 'CROWN_JEWEL';
  }
  return 'STANDARD';
}

export function summarize(files, protectedRoots) {
  const buckets = new Map();
  for (const { path, identities } of files) {
    const criticality = criticalityFor(path, protectedRoots);
    const bucket = buckets.get(criticality) ?? { total: 0, AI_AND_HUMAN: 0, AI_ONLY: 0, HUMAN_ONLY: 0, AUTOMATION_ONLY: 0, NO_HISTORY: 0 };
    bucket.total += 1;
    bucket[classifyTouch(identities)] += 1;
    buckets.set(criticality, bucket);
  }
  const out = {};
  for (const [criticality, bucket] of buckets) {
    out[criticality] = { ...bucket, aiTouched: bucket.AI_AND_HUMAN + bucket.AI_ONLY };
  }
  return out;
}

function collectTouches() {
  // Маркер печатаемый: NUL в argv передать нельзя.
  const result = spawnSync('git', ['log', '--all', '--no-merges', '--format=@@A@@%an\t%ae', '--name-only'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`git log failed: ${result.stderr?.slice(0, 400)}`);
  const touched = new Map();
  let current = null;
  for (const line of result.stdout.split('\n')) {
    if (line.startsWith('@@A@@')) {
      const payload = line.slice(5);
      const tab = payload.indexOf('\t');
      current = contributorId(payload.slice(0, tab), payload.slice(tab + 1));
      continue;
    }
    if (!line || current === null) continue;
    let set = touched.get(line);
    if (!set) { set = new Set(); touched.set(line, set); }
    set.add(current);
  }
  return touched;
}

function main() {
  const protectedRoots = JSON.parse(readFileSync(boundaryPath, 'utf8')).protectedRoots ?? [];
  const touched = collectTouches();
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\n').filter(Boolean);

  const files = tracked.map((path) => ({ path, identities: [...(touched.get(path) ?? [])] }));
  const byCriticality = summarize(files, protectedRoots);
  const total = files.length;
  const aiTouched = Object.values(byCriticality).reduce((sum, bucket) => sum + bucket.aiTouched, 0);

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    method: 'Множество личностей-авторов по всей истории (--all, без merge-коммитов) на каждый отслеживаемый файл. Авторство коммита не равно авторству содержимого.',
    aiIdentities: [...AI_IDENTITIES],
    trackedFiles: total,
    aiTouchedFiles: aiTouched,
    aiTouchedPercent: Number(((100 * aiTouched) / total).toFixed(1)),
    byCriticality,
  };

  const outPath = join(outDir, 'AI_ATTRIBUTION.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`AI attribution: ${aiTouched}/${total} файлов (${report.aiTouchedPercent}%) несут след инструмента в истории`);
  for (const [criticality, bucket] of Object.entries(byCriticality)) {
    console.log(`  ${criticality}: ${bucket.aiTouched}/${bucket.total} — AI_ONLY ${bucket.AI_ONLY}, AI_AND_HUMAN ${bucket.AI_AND_HUMAN}, HUMAN_ONLY ${bucket.HUMAN_ONLY}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('build-ai-attribution.mjs')) main();
