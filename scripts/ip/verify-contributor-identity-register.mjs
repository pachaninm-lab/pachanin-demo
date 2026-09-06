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
// --strict: exact equality on every count. Use it immediately after --write, on
// a full clone, to confirm the regeneration landed. It is not the default,
// because the tool identities gain a commit with every commit made - including
// the one that would carry the fix - so exact equality is stale the moment it is
// true.
//
// Default (and --baseline, its explicit alias): only the direction-safe half is
// enforced, because the
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
// Exact equality against live git is only meaningful in the moment right after a
// regeneration: the tool identities gain a commit every time anything is
// committed, including the commit that carries the regenerated register. So the
// default is the direction-safe check, and --strict is for the regeneration
// itself. --baseline is kept as an explicit alias for what CI asks for.
const STRICT = process.argv.includes('--strict');
const BASELINE = !STRICT;

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

// Merges are counted separately rather than ignored. A merge commit carries no
// creative expression of its own - it records a decision to accept work, and its
// content is the resolution, usually empty - so it does not belong in the
// authorship basis. But an identity whose only commits are merges is not absent
// from history, and saying it is would be a false statement in a document that
// ends up attached to a declaration of authorship. claude[bot] is exactly this
// case: four merges, no authored commits.
const merges = new Map();
for (const name of execFileSync('git', ['log', '--all', '--merges', '--format=%aN'], {
  encoding: 'utf8',
  maxBuffer: 1024 * 1024 * 64,
}).split('\n').filter(Boolean)) {
  merges.set(name, (merges.get(name) ?? 0) + 1);
}

const register = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
const declared = new Map();
for (const identity of register.identities ?? []) {
  declared.set(identity.displayName, identity);
}
for (const identity of register.ciAutomation?.identities ?? []) {
  // The CI block holds the class once, on the block, not on each entry; the rule
  // that only a human contributor's growth is a failure needs it per identity.
  declared.set(identity.displayName, { ...identity, class: register.ciAutomation.class, __ci: identity });
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
    if (WRITE) { entry.commits = count; if (entry.__ci) entry.__ci.commits = count; }
    else if (!BASELINE) problems.push(`РАСХОЖДЕНИЕ: «${name}» — в реестре ${entry.commits}, измерено ${count}`);
    else if (count > entry.commits && entry.class === 'HUMAN_CONTRIBUTOR') {
      // Growth is enforced only for a human contributor other than the
      // principal, because only that growth opens a rights gap that a document
      // has to close. The principal's own count and the tool identities' counts
      // rise with every commit by design; failing on those would make the gate
      // red on any branch that adds a commit after the register was regenerated,
      // which is every branch.
      problems.push(`РОСТ: «${name}» — в реестре ${entry.commits}, измерено ${count}; вклад неоформленного контрибьютора вырос`);
    } else if (count > entry.commits) {
      notes.push(`выше зафиксированного (ожидаемо для класса ${entry.class ?? '—'}): «${name}» — ${entry.commits} → ${count}`);
    } else {
      notes.push(`ниже зафиксированного: «${name}» — в реестре ${entry.commits}, в этом наборе ссылок ${count}`);
    }
  }
}

for (const [name, entry] of [...declared].sort()) {
  if (measured.has(name)) continue;
  if (WRITE) {
    const target = entry.__ci ?? entry;
    target.commits = 0;
    entry.commits = 0;
    target.mergeCommits = merges.get(name) ?? 0;
    entry.mergeCommits = target.mergeCommits;
    target.absentFromHistory = entry.mergeCommits > 0
      ? `Авторских коммитов нет: ${entry.mergeCommits} слияни(я/й) и ничего более. Слияние фиксирует решение принять работу, а не самостоятельное творческое выражение, и в базис авторства не входит.`
      : 'Коммиты этой идентичности недостижимы из ссылок, имеющихся у этого клона репозитория; запись сохранена, чтобы классификация оставалась полной.';
  } else if (BASELINE) {
    const m = merges.get(name) ?? 0;
    notes.push(m > 0
      ? `авторских коммитов нет, только слияния: «${name}» (${m})`
      : `не достижим из этого набора ссылок: «${name}» (в реестре ${entry.commits})`);
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
  for (const [name, entry] of declared) {
    const m = merges.get(name) ?? 0;
    if (m > 0) (entry.__ci ?? entry).mergeCommits = m;
  }
  register.completeness.identitiesEnumerated = declared.size;
  register.completeness.basis = `git ${BASIS.join(' ')}`;
  register.completeness.mergeBasis = 'git log --all --merges --format=%aN — считается отдельно и в базис авторства не входит.';
  register.completeness.mergesByPrincipalOnDefaultBranch = Number(
    execFileSync('bash', ['-c', "git log origin/main --merges --format='%aN' | grep -cx pachaninm-lab || true"], { encoding: 'utf8' }).trim(),
  );
  register.completeness.mergesTotalOnDefaultBranch = Number(
    execFileSync('bash', ['-c', "git log origin/main --merges --format='%aN' | wc -l"], { encoding: 'utf8' }).trim(),
  );
  register.completeness.measuredAt = new Date().toISOString();
  register.completeness.verifier = 'node scripts/ip/verify-contributor-identity-register.mjs';
  fs.writeFileSync(REGISTER, `${JSON.stringify(register, null, 2)}\n`);
  console.log(`Реестр идентичностей перезаписан по измерению: ${declared.size} идентичностей, ${measuredTotal} коммитов.`);
  process.exit(0);
}

// The legal documents quote these counts in prose. Prose does not recompute, so
// a figure typed into a declaration of authorship stays wrong forever once the
// history moves past it - which is precisely how 24 849 and 88.8 % survived into
// a document meant for signature. Each quoted figure is checked here.
//
// The comparison is against the REGISTER, not against live git. The register is
// a deliberate measurement with a recorded timestamp; live git moves with every
// commit, including the commit that would carry the fix, so checking prose
// against it would leave the documents permanently one commit behind and the
// gate permanently red. Register-versus-git drift is a separate question,
// handled above by class: only an unformalised human contributor's growth fails.
const registerPrincipal = declared.get(register.rightsholder?.displayName ?? 'pachaninm-lab');
const quoted = [
  ['docs/ip/CHAIN_OF_TITLE_REGISTER.md', /(\d[\d\u00a0 ]*) коммитов из (\d[\d\u00a0 ]*)/u, 'principalOfTotal'],
  ['docs/ip/legal/01-declaration-of-authorship-principal.md', /\*\*(\d[\d\u00a0 ]*) коммитов из (\d[\d\u00a0 ]*)\*\*/u, 'principalOfTotal'],
  ['docs/ip/rospatent/01-zayavlenie.md', /(\d[\d\u00a0 ]*) коммитов из (\d[\d\u00a0 ]*)/u, 'principalOfTotal'],
  ['docs/ip/CHAIN_OF_TITLE_REGISTER.md', /`Claude` (\d+) коммит/u, 'claude'],
  ['docs/ip/legal/05-ai-tool-provenance-statement.md', /`Claude <noreply@anthropic\.com>` \((\d+) коммит/u, 'claude'],
];
const digits = (text) => Number(String(text).replace(/[^\d]/gu, ''));
for (const [file, pattern, kind] of quoted) {
  if (!fs.existsSync(file)) continue;
  const match = fs.readFileSync(file, 'utf8').match(pattern);
  if (!match) {
    problems.push(`ЦИТАТА НЕ НАЙДЕНА: ${file} — ожидалась формулировка со счётчиками (${kind})`);
    continue;
  }
  if (kind === 'principalOfTotal') {
    const registerTotal = register.completeness?.totalCommitsNoMerges;
    if (digits(match[1]) !== registerPrincipal?.commits || digits(match[2]) !== registerTotal) {
      problems.push(`ЦИТАТА РАСХОДИТСЯ: ${file} — «${digits(match[1])} из ${digits(match[2])}», в реестре «${registerPrincipal?.commits} из ${registerTotal}»`);
    }
  } else if (kind === 'claude') {
    const claude = declared.get('Claude')?.commits;
    if (digits(match[1]) !== claude) {
      problems.push(`ЦИТАТА РАСХОДИТСЯ: ${file} — «Claude ${digits(match[1])}», в реестре ${claude}`);
    }
  }
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
