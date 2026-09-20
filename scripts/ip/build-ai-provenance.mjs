#!/usr/bin/env node
/**
 * Surviving-line authorship attribution, and the AI provenance that follows from it.
 *
 * build-ip-clean-room.mjs records an `ai_involvement` value derived from the set of
 * addresses that ever TOUCHED a file. That is the right basis for the rights gate --
 * a contributor who has since been edited away still once held rights -- but it is the
 * wrong basis for describing what the product is made of today. A file whose every
 * surviving line was written by an assistant still reports human authorship there,
 * because a human made its first commit. Read as a statement about the current code,
 * that understates AI-authored material to zero.
 *
 * This script answers the other question: of the lines that are actually in HEAD, who
 * wrote them. It blames every tracked file once and tallies surviving lines per
 * contributor class, which yields three artifacts the IP package needs:
 *
 *   - AI_PROVENANCE.csv          per-file surviving-line attribution
 *   - AI_ONLY_FILES.csv          files with no surviving human-authored line
 *   - PLATON_ASSIGNMENT_SCHEDULE.csv  the exact schedule an assignment must cover
 *
 * The AI-only finding is not a rights defect in the sense the other registers use.
 * Nobody else claims those lines. The exposure is the opposite one: whether copyright
 * arose in them at all. See docs/ip/AI_ASSISTED_PROVENANCE.md.
 *
 * Usage: node scripts/ip/build-ai-provenance.mjs [outDir]
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { hashEmail, parseRightsRegister } from './contributor-rights.mjs';

const outDir = process.argv[2] ?? 'docs/ip';
mkdirSync(outDir, { recursive: true });

function git(args, maxBuffer = 64 * 1024 * 1024) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer });
}

const head = git(['rev-parse', 'HEAD']).trim();

const registerDocument = JSON.parse(readFileSync('docs/ip/contributor-rights-register.json', 'utf8'));
const { byEmail, defects } = parseRightsRegister(registerDocument);
if (defects.length) throw new Error(`contributor-rights-register.json is defective: ${defects.join(', ')}`);

const boundary = JSON.parse(readFileSync('docs/ip/proprietary-core-boundary.json', 'utf8'));
const protectedRoots = boundary.protectedRoots ?? [];
function criticalityOf(path) {
  const entry = protectedRoots.find((root) => path === root.path || path.startsWith(`${root.path}/`));
  return entry?.criticality ?? 'STANDARD';
}

// An address missing from the register is UNREGISTERED rather than silently human or
// silently AI. It must not be able to masquerade as either. Lookup is by the SHA-256
// of the lowercased address; raw addresses are personal data and never leave this loop.
function classOf(emailHash) {
  return byEmail.get(emailHash)?.contributorClass ?? 'UNREGISTERED';
}

// The third-party human whose material the assignment schedule must cover.
const THIRD_PARTY_HUMAN_HASHES = new Set(
  registerDocument.identities
    .filter((identity) => identity.contributorClass === 'THIRD_PARTY_HUMAN')
    .flatMap((identity) => identity.emailsSha256 ?? []),
);

// Classes whose surviving lines count as human authorship. UNATTRIBUTED_SERVER_IDENTITY
// is counted here deliberately: a root shell is probably a person, and assuming
// otherwise would inflate the AI-only finding.
const HUMAN_CLASSES = new Set(['OWNER', 'THIRD_PARTY_HUMAN', 'UNATTRIBUTED_SERVER_IDENTITY', 'UNREGISTERED']);

const tracked = git(['ls-files', '-z'], 256 * 1024 * 1024).split('\0').filter(Boolean);

const rows = [];
let unblameable = 0;

for (const [index, path] of tracked.entries()) {
  if (index > 0 && index % 500 === 0) process.stderr.write(`${index}/${tracked.length}\n`);

  let blame;
  try {
    blame = git(['blame', '--line-porcelain', 'HEAD', '--', path]);
  } catch {
    unblameable += 1;
    continue;
  }

  const byClass = new Map();
  const byEmailCount = new Map();
  let email = '';
  let total = 0;
  for (const line of blame.split(/\r?\n/u)) {
    if (line.startsWith('author-mail ')) {
      email = hashEmail(line.slice(12).trim().replace(/^<|>$/gu, ''));
      continue;
    }
    if (!line.startsWith('\t')) continue;
    total += 1;
    const contributorClass = classOf(email);
    byClass.set(contributorClass, (byClass.get(contributorClass) ?? 0) + 1);
    byEmailCount.set(email, (byEmailCount.get(email) ?? 0) + 1);
  }
  if (total === 0) continue;

  const humanLines = [...byClass].reduce(
    (sum, [contributorClass, count]) => (HUMAN_CLASSES.has(contributorClass) ? sum + count : sum),
    0,
  );
  const aiLines = byClass.get('AI_ASSISTANT') ?? 0;

  rows.push({
    path,
    criticality: criticalityOf(path),
    total,
    owner: byClass.get('OWNER') ?? 0,
    ai: aiLines,
    thirdPartyHuman: byClass.get('THIRD_PARTY_HUMAN') ?? 0,
    bot: byClass.get('AUTOMATION_BOT') ?? 0,
    unattributed: byClass.get('UNATTRIBUTED_SERVER_IDENTITY') ?? 0,
    unregistered: byClass.get('UNREGISTERED') ?? 0,
    humanLines,
    humanAuthorship: humanLines > 0 ? 'SURVIVING' : 'NONE_SURVIVING',
    thirdPartyLines: [...byEmailCount]
      .filter(([hash]) => THIRD_PARTY_HUMAN_HASHES.has(hash))
      .reduce((sum, [, count]) => sum + count, 0),
  });
}

function csv(header, records) {
  return [header.join(','), ...records].join('\n') + '\n';
}
function quote(value) {
  const text = String(value);
  return /[",\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

writeFileSync(
  join(outDir, 'AI_PROVENANCE.csv'),
  csv(
    ['path', 'criticality', 'total_lines', 'owner_lines', 'ai_lines', 'third_party_human_lines',
      'automation_lines', 'unattributed_lines', 'unregistered_lines', 'human_authorship'],
    rows.map((row) => [
      quote(row.path), row.criticality, row.total, row.owner, row.ai,
      row.thirdPartyHuman, row.bot, row.unattributed, row.unregistered, row.humanAuthorship,
    ].join(',')),
  ),
);

// AI-only: assistant lines survive and no human-authored line does.
const aiOnly = rows.filter((row) => row.ai > 0 && row.humanLines === 0);
writeFileSync(
  join(outDir, 'AI_ONLY_FILES.csv'),
  csv(
    ['path', 'criticality', 'total_lines', 'ai_lines', 'automation_lines'],
    aiOnly
      .sort((a, b) => b.ai - a.ai || a.path.localeCompare(b.path))
      .map((row) => [quote(row.path), row.criticality, row.total, row.ai, row.bot].join(',')),
  ),
);

const thirdParty = rows.filter((row) => row.thirdPartyLines > 0);
writeFileSync(
  join(outDir, 'PLATON_ASSIGNMENT_SCHEDULE.csv'),
  csv(
    ['path', 'criticality', 'surviving_lines_authored', 'total_lines_in_file', 'share_percent', 'wholly_authored'],
    thirdParty
      .sort((a, b) => b.thirdPartyLines - a.thirdPartyLines || a.path.localeCompare(b.path))
      .map((row) => [
        quote(row.path), row.criticality, row.thirdPartyLines, row.total,
        ((row.thirdPartyLines / row.total) * 100).toFixed(1),
        row.thirdPartyLines === row.total ? 'YES' : 'NO',
      ].join(',')),
  ),
);

const sum = (records, key) => records.reduce((total, row) => total + row[key], 0);
const inBoundary = (records) => records.filter((row) => row.criticality !== 'STANDARD');
const crownJewel = (records) => records.filter((row) => row.criticality === 'CROWN_JEWEL');

const summary = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  gitHead: head,
  basis: 'SURVIVING_LINES_IN_HEAD',
  note: 'Attribution is by Git author address. An address proves who committed a line, not that no other person contributed to its creation. AI-authored lines were produced under owner direction; see docs/ip/AI_ASSISTED_PROVENANCE.md.',
  trackedFiles: tracked.length,
  attributedFiles: rows.length,
  unblameableFiles: unblameable,
  totalSurvivingLines: sum(rows, 'total'),
  linesByClass: {
    OWNER: sum(rows, 'owner'),
    AI_ASSISTANT: sum(rows, 'ai'),
    THIRD_PARTY_HUMAN: sum(rows, 'thirdPartyHuman'),
    AUTOMATION_BOT: sum(rows, 'bot'),
    UNATTRIBUTED_SERVER_IDENTITY: sum(rows, 'unattributed'),
    UNREGISTERED: sum(rows, 'unregistered'),
  },
  aiOnly: {
    files: aiOnly.length,
    lines: sum(aiOnly, 'ai'),
    withinProtectedBoundary: inBoundary(aiOnly).length,
    withinProtectedBoundaryLines: sum(inBoundary(aiOnly), 'ai'),
    crownJewel: crownJewel(aiOnly).length,
    crownJewelLines: sum(crownJewel(aiOnly), 'ai'),
  },
  thirdPartyHuman: {
    files: thirdParty.length,
    lines: sum(thirdParty, 'thirdPartyLines'),
    withinProtectedBoundary: inBoundary(thirdParty).length,
    crownJewel: crownJewel(thirdParty).length,
    whollyAuthoredFiles: thirdParty.filter((row) => row.thirdPartyLines === row.total).length,
  },
};

writeFileSync(join(outDir, 'AI_PROVENANCE_SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
