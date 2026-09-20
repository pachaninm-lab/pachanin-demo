// Rights evidence for first-party classification.
//
// The clean-room classifier defaults every file to UNKNOWN and presumes nothing
// owned. This module supplies the only route out of that default, and the route is
// authorship evidence rather than assertion: docs/ip/contributor-rights-register.json
// maps each Git author address to a rights status, and a file clears only when no
// address lacking a resolved basis has authorship in it.
//
// Two tiers, the cheap one deliberately the stricter:
//   TOUCH_HISTORY  - no unresolved address ever touched the file. Sound without
//                    reading a line, and free from the history walk.
//   SURVIVING_LINE - an unresolved address did touch it, so the file is blamed and
//                    clears only if none of its lines survive in HEAD.
//
// An address absent from the register counts as unresolved, so a new contributor
// can never silently inherit somebody else's rights basis.
//
// Identities are matched by the SHA-256 of the lowercased author address, never by
// the address itself. Raw addresses are personal data and are not stored in Git; the
// hash is the same identifier CONTRIBUTORS.csv already publishes.

import { createHash } from 'node:crypto';

export function hashEmail(email) {
  return createHash('sha256').update(String(email ?? '').trim().toLowerCase()).digest('hex');
}

export function parseRightsRegister(document) {
  const byEmail = new Map();
  const defects = [];
  if (document === null || typeof document !== 'object') return { byEmail, defects: ['DOCUMENT_NOT_AN_OBJECT'] };
  if (document.schemaVersion !== 1) return { byEmail, defects: ['UNSUPPORTED_SCHEMA_VERSION'] };
  for (const identity of Array.isArray(document.identities) ? document.identities : []) {
    const contributorClass = String(identity?.contributorClass ?? '');
    const rightsStatus = String(identity?.rightsStatus ?? '');
    if (!contributorClass) { defects.push('MISSING_CONTRIBUTOR_CLASS'); continue; }
    if (rightsStatus !== 'RESOLVED' && rightsStatus !== 'UNRESOLVED') {
      defects.push(`UNSUPPORTED_RIGHTS_STATUS:${contributorClass}`); continue;
    }
    if (rightsStatus === 'RESOLVED' && String(identity?.rightsBasis ?? '').trim().length < 8) {
      defects.push(`RESOLVED_WITHOUT_RIGHTS_BASIS:${contributorClass}`); continue;
    }
    const hashes = Array.isArray(identity?.emailsSha256) ? identity.emailsSha256 : [];
    if (!hashes.length) { defects.push(`NO_EMAILS:${contributorClass}`); continue; }
    for (const raw of hashes) {
      const hash = String(raw ?? '').trim().toLowerCase();
      if (!hash) { defects.push(`EMPTY_EMAIL:${contributorClass}`); continue; }
      // A raw address here would be both a privacy defect and a silent lookup miss.
      if (!/^[0-9a-f]{64}$/u.test(hash)) { defects.push(`NOT_A_SHA256:${contributorClass}`); continue; }
      if (byEmail.has(hash)) { defects.push(`DUPLICATE_EMAIL:${hash}`); continue; }
      byEmail.set(hash, { contributorClass, rightsStatus, rightsBasis: identity.rightsBasis });
    }
  }
  return { byEmail, defects };
}

export function rightsSets(byEmail) {
  const resolved = new Set();
  const unresolved = new Set();
  const ai = new Set();
  const bot = new Set();
  for (const [email, identity] of byEmail) {
    (identity.rightsStatus === 'RESOLVED' ? resolved : unresolved).add(email);
    if (identity.contributorClass === 'AI_ASSISTANT') ai.add(email);
    if (identity.contributorClass === 'AUTOMATION_BOT') bot.add(email);
  }
  return { resolved, unresolved, ai, bot, known: new Set(byEmail.keys()) };
}

export function aiInvolvementFor(emails, sets) {
  const present = [...emails];
  const ai = present.filter((email) => sets.ai.has(email));
  if (!ai.length) return 'NO_AI_AUTHOR_RECORDED';
  const human = present.filter((email) => !sets.ai.has(email) && !sets.bot.has(email));
  return human.length ? 'DECLARED_AI_ASSISTED_WITH_HUMAN_AUTHORSHIP' : 'DECLARED_AI_AUTHORED_NO_HUMAN_AUTHOR_IN_SET';
}

// historyEmails: every author address that ever touched the file.
// blameEmails: lazy accessor returning the addresses owning surviving lines, or null
// when the file cannot be blamed.
// deminimis: optional lazy accessor, called only when surviving lines from an
// unresolved address are the sole obstacle. It receives those addresses and returns
// {ok, detail} when every line they own in this file has been verified as carrying no
// expression (see scripts/ip/deminimis-adjudication.mjs), otherwise a falsy value.
// Returns evidence, or null when not established.
export function evaluateRights(historyEmails, blameEmails, sets, deminimis) {
  if (!historyEmails || historyEmails.size === 0) return null;
  const offending = [...historyEmails].filter((email) => !sets.known.has(email) || sets.unresolved.has(email));
  if (offending.length === 0) {
    return {
      tier: 'TOUCH_HISTORY',
      detail: `no unresolved author in full history of ${historyEmails.size} author address(es)`,
      aiInvolvement: aiInvolvementFor(historyEmails, sets),
    };
  }
  const surviving = blameEmails();
  if (!surviving || surviving.size === 0) return null;
  const survivingOffending = [...surviving].filter((email) => !sets.known.has(email) || sets.unresolved.has(email));
  if (survivingOffending.length) {
    if (typeof deminimis !== 'function') return null;
    const verdict = deminimis(survivingOffending.sort());
    if (!verdict || verdict.ok !== true) return null;
    return {
      tier: 'DE_MINIMIS_RESIDUE',
      detail: `author address(es) without a resolved rights basis ${JSON.stringify(survivingOffending.sort())} own surviving lines in this file, and every one of those lines was verified to carry no expression: ${verdict.detail}`,
      aiInvolvement: aiInvolvementFor(surviving, sets),
    };
  }
  return {
    tier: 'SURVIVING_LINE',
    detail: `author address(es) without a resolved rights basis ${JSON.stringify(offending.sort())} touched this file, and no line of theirs survives in HEAD`,
    aiInvolvement: aiInvolvementFor(surviving, sets),
  };
}
