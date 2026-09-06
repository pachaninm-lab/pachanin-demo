#!/usr/bin/env node
// Verifies docs/ip/contributor-identity-register.json against git.
//
// The register carries the legal classification of every identity that has ever
// authored a commit. Its reasoning is written by a human; its numbers must not
// be. A hand-typed commit count in a document that ends up attached to a
// declaration of authorship is an unverifiable assertion, and one that drifts
// the moment history moves - which is exactly how the first draft came to claim
// a total 1210 commits above the measured one.
//
// Two modes, because the two questions have different stability.
//
// Default (local, --strict): exact equality on every count. Use it when
// regenerating the register on a full clone.
//
// --baseline (CI): only the direction-safe half is enforced, because the
// enumerating basis is not stable. `git log --all` sees the refs a checkout
// happens to hold, and this repository has 4 500+ branches - a CI checkout and a
// developer clone legitimately disagree on the total. Enforcing exact equality
// there would paint the build red for a reason no change caused, and a gate that
// is red for reasons nobody caused stops being read. So CI enforces:
//   - every identity git can see must be classified (a new contributor cannot
//     enter the tree unclassified - this direction is stable, since an identity
//     visible in a smaller ref set is visible in a larger one)
//   - no identity may exceed its recorded count (a footprint may not grow)
// and reports, without failing, a count that measures lower than recorded.
//
// The surviving-lines KPI in verify-first-party-provenance.mjs is what actually
// bounds an unformalised contributor's footprint: it blames the working tree and
// so does not depend on which refs exist at all.
//
// Pass --write to rewrite the register's numeric fields from the measurement,
// leaving every classification, rationale and legal basis untouched.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const REGISTER = 'docs/ip/contributor-identity-register.json';
const WRITE = process.argv.includes('--write');
const BASELINE = process.argv.includes('--baseline');

// Enumerated over every ref, not just the default branch: squash merges rewrite
// authorship on main, so a main-only count silently drops contributors whose
// work reached the product through a squashed pull request. Platon measures 88
// here and 27 on main; the wider number is the one that must not miss anybody.
const BASIS = ['log', '--all', '--no-merges', '--format=%aN'];

const measured = new Map();
for (const name of execFileSync('git', BASIS, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 })
  .split('\n')
  .filter(Boolean)) {
  measured.set(name, (measured.get(name) ?? 0) + 1);
}
const measuredTotal = [...measured.values()].reduce((s, n) => s + n, 0);

const register = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
const declared = new Map();
for (const identity of register.identities ?? []) {
  declared.set(identity.displayName, identity);
}
for (const identity of register.ciAutomation?.identities ?? []) {
  declared.set(identity.displayName, identity);
}

const problems = [];
const notes = [];

for (const [name, count] of [...measured].sort()) {
  const entry = declared.get(name);
  if (!entry) {
    problems.push(`НЕ КЛАССИФИЦИРОВАН: «${name}» — ${count} коммит(ов) в истории, но записи в реестре нет`);
    continue;
  }
  if (entry.commits !== count) {
    if (WRITE) entry.commits = count;
    else if (!BASELINE) problems.push(`РАСХОЖДЕНИЕ: «${name}» — в реестре ${entry.commits}, измерено ${count}`);
    else if (count > entry.commits) {
      problems.push(`РОСТ: «${name}» — в реестре ${entry.commits}, измерено ${count}; вклад вырос сверх зафиксированного`);
    } else {
      notes.push(`ниже зафиксированного: «${name}» — в реестре ${entry.commits}, в этом наборе ссылок ${count}`);
    }
  }
}

for (const [name, entry] of [...declared].sort()) {
  if (measured.has(name)) continue;
  if (WRITE) {
    entry.commits = 0;
    entry.absentFromHistory = 'Идентичность не имеет коммитов в текущей истории репозитория; запись сохранена, чтобы классификация оставалась полной.';
  } else if (BASELINE) {
    notes.push(`не достижим из этого набора ссылок: «${name}» (в реестре ${entry.commits})`);
  } else if (entry.commits !== 0 || !entry.absentFromHistory) {
    // An entry may legitimately measure zero: `--all` only sees the refs this
    // checkout has, and a branch that has since been pruned takes its commits
    // with it. That is tolerated only when the register says so out loud - a
    // silent zero would let a real identity disappear from the classification.
    problems.push(`ОТСУТСТВУЕТ В ИСТОРИИ: «${name}» — реестр объявляет ${entry.commits} коммит(ов), измерено 0`);
  }
}

const declaredTotal = register.completeness?.totalCommitsNoMerges;
if (declaredTotal !== measuredTotal) {
  if (WRITE) {
    register.completeness.totalCommitsNoMerges = measuredTotal;
  } else if (BASELINE) {
    notes.push(`итог: реестр объявляет ${declaredTotal}, в этом наборе ссылок ${measuredTotal}`);
  } else {
    problems.push(`ИТОГ: реестр объявляет ${declaredTotal}, измерено ${measuredTotal}`);
  }
}

const classifiedTotal = [...declared.values()].reduce((s, e) => s + (e.commits ?? 0), 0);
if (classifiedTotal !== measuredTotal && !WRITE && !BASELINE) {
  problems.push(`СУММА ПО КЛАССАМ: ${classifiedTotal} != ${measuredTotal}`);
}

if (WRITE) {
  register.completeness.identitiesEnumerated = declared.size;
  register.completeness.basis = `git ${BASIS.join(' ')}`;
  register.completeness.measuredAt = new Date().toISOString();
  register.completeness.verifier = 'node scripts/ip/verify-contributor-identity-register.mjs';
  fs.writeFileSync(REGISTER, `${JSON.stringify(register, null, 2)}\n`);
  console.log(`Реестр идентичностей перезаписан по измерению: ${declared.size} идентичностей, ${measuredTotal} коммитов.`);
  process.exit(0);
}

const principal = declared.get(register.rightsholder?.displayName ?? 'pachaninm-lab');
const share = principal ? ((principal.commits / measuredTotal) * 100).toFixed(1) : '—';

console.log(`Реестр идентичностей: ${declared.size} идентичностей, ${measuredTotal} коммитов (${BASIS.join(' ')})`);
console.log(`  доля правообладателя: ${principal?.commits ?? 0} / ${measuredTotal} = ${share}%`);

for (const note of notes) console.log(`  примечание: ${note}`);

if (problems.length > 0) {
  console.error('');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  console.error(`Реестр не соответствует истории: ${problems.length} расхождени(й). Пересобрать: node ${process.argv[1]} --write`);
  process.exit(1);
}
console.log('  расхождений с историей нет');
