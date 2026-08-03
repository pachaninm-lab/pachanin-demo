#!/usr/bin/env node
/**
 * PC-CROP-10C applicability.
 *
 * The PC-CROP-10C gate verifies one thing: the FGIS Grain tenant-read authority
 * and the 15-path scope that governs it. Its verifier asserts that a change
 * stays inside that scope, which is the correct rule for a PC-CROP branch and
 * the wrong rule for everybody else — an unrelated PR touches hundreds of files
 * by design, so the gate failed it for being unrelated rather than for being
 * unsafe.
 *
 * The workflow already printed NOT_APPLICABLE for foreign branches, but only
 * for the project lock: it then ran the scope verifier anyway, so the decision
 * had no effect. This module makes the decision once, before the verifier, and
 * the workflow acts on it.
 *
 * The 15 governed paths are not all the same kind of thing, and treating them
 * alike is what makes a naive rule wrong in both directions:
 *
 *   - EXCLUSIVE_PATHS exist only to serve the tenant-read authority. Touching
 *     one is PC-CROP work no matter what the branch is called, so it confers
 *     applicability — a branch name cannot buy an exemption.
 *   - SHARED_PATHS are monorepo-wide files the slice happens to extend.
 *     `apps/api/prisma/schema.prisma` holds every model in the platform; almost
 *     any PR touches it. Path-level granularity would make every unrelated PR
 *     applicable, so these are scoped by content: only a change inside a
 *     PC-CROP-owned Prisma block counts.
 *   - GOVERNANCE_PATHS describe how the gate runs. Editing them alone is not
 *     tenant-read work, so it does not confer applicability — but it does
 *     trigger an integrity check, so the gate cannot be softened by a PR that
 *     then exempts itself.
 *
 * Events are scoped by the same content rule, and for the same reason. A push
 * to main is not self-evidently PC-CROP work: merging any unrelated PR that
 * touched the shared schema replays that PR's whole diff through the scope
 * verifier, which rejects every path outside the 15. Deciding a push on
 * content keeps main verified whenever the authority actually moves, without
 * turning main red for changes the gate is not the authority for. Only
 * workflow_dispatch is unconditional, because it is a person asking.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const SCHEMA_VERSION = 'pc-crop-10c.applicability.v2';

/**
 * Files that describe how the gate runs. Changing only these does not make a
 * change part of the tenant-read authority, but does require the integrity
 * check below.
 */
export const GOVERNANCE_PATHS = Object.freeze([
  '.github/workflows/pc-crop-10c.yml',
  'docs/platform-v7/autopilot/scopes/pc-crop-10c.json',
]);

/**
 * Monorepo-wide files the slice extends but does not own. Scoped by content:
 * see PC_CROP_OWNED_PRISMA_BLOCKS.
 */
export const SHARED_PATHS = Object.freeze([
  'apps/api/prisma/schema.prisma',
]);

/**
 * The tenant-read authority itself. Touching any of these is what the gate
 * exists to verify, regardless of who is touching it.
 */
export const EXCLUSIVE_PATHS = Object.freeze([
  'apps/api/prisma/migrations/20260730101500_fgis_grain_tenant_read_authority/migration.sql',
  'apps/api/src/modules/regulatory-integration/regulatory-integration.module.ts',
  'apps/api/src/modules/regulatory-integration/dto/fgis-grain-tenant-read.dto.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.contract.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.contract.spec.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.transport.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.repository.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.repository.spec.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.controller.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.controller.spec.ts',
  'apps/api/test/industrial/fgis-grain-tenant-read.e2e-spec.ts',
  'scripts/pc-crop-10c/verify.mjs',
]);

/**
 * The Prisma blocks the PC-CROP-10C slice owns inside the shared schema. Each
 * maps to a table its own migration creates; findGovernanceIntegrityFailures
 * asserts that correspondence so this list cannot silently drift.
 */
export const PC_CROP_OWNED_PRISMA_BLOCKS = Object.freeze([
  'FgisGrainTenantReadAuthorization',
  'FgisGrainTenantReadProviderClaim',
  'FgisGrainTenantReadAudit',
  'FgisGrainTenantReadAuditHead',
]);

export const SHARED_SCHEMA_PATH = 'apps/api/prisma/schema.prisma';
export const PC_CROP_MIGRATION_PATH =
  'apps/api/prisma/migrations/20260730101500_fgis_grain_tenant_read_authority/migration.sql';

/** Branches whose whole purpose is PC-CROP work. */
export const PC_CROP_BRANCH_PATTERN = /^(?:agent|fix|governance|ops)\/pc-crop-/;

export function isPcCropBranch(headRef) {
  return PC_CROP_BRANCH_PATTERN.test(String(headRef ?? ''));
}

/**
 * Splits a Prisma schema into its top-level blocks. Prisma always closes a
 * top-level block with `}` in column 0, which is what makes this reliable
 * without a full parser.
 *
 * @returns {Map<string, string>} block name → normalized block text
 */
export function extractPrismaBlocks(source) {
  const blocks = new Map();
  if (typeof source !== 'string') return blocks;

  const lines = source.split('\n');
  let current = null;
  let buffer = [];

  for (const line of lines) {
    if (current === null) {
      const opener = /^(?:model|enum|view|type)\s+(\w+)\s*\{/.exec(line);
      if (opener) {
        current = opener[1];
        buffer = [line.trimEnd()];
      }
      continue;
    }
    buffer.push(line.trimEnd());
    if (line === '}' || /^\}\s*$/.test(line)) {
      blocks.set(current, buffer.join('\n'));
      current = null;
      buffer = [];
    }
  }

  return blocks;
}

/**
 * Which PC-CROP-owned blocks actually differ between two revisions of the
 * shared schema. A block present on exactly one side counts as changed.
 *
 * @returns {string[]} owned block names whose text differs
 */
export function findChangedOwnedBlocks(baseSource, headSource, owned = PC_CROP_OWNED_PRISMA_BLOCKS) {
  const baseBlocks = extractPrismaBlocks(baseSource);
  const headBlocks = extractPrismaBlocks(headSource);
  return owned.filter((name) => baseBlocks.get(name) !== headBlocks.get(name));
}

/**
 * @param {{
 *   eventName: string,
 *   headRef?: string,
 *   changedFiles?: string[],
 *   changedOwnedBlocks?: string[] | null,
 * }} input
 */
export function resolveApplicability(input) {
  const eventName = String(input?.eventName ?? '');
  const headRef = String(input?.headRef ?? '');
  const changedFiles = (input?.changedFiles ?? [])
    .map((file) => String(file).trim())
    .filter(Boolean);

  const exclusiveTouched = changedFiles.filter((file) => EXCLUSIVE_PATHS.includes(file));
  const sharedTouched = changedFiles.filter((file) => SHARED_PATHS.includes(file));
  const governanceTouched = changedFiles.filter((file) => GOVERNANCE_PATHS.includes(file));

  // Absence of evidence is not evidence of absence: if a shared file changed
  // and nobody told us which owned blocks moved, assume the authority moved.
  const ownedBlocksUninspected = sharedTouched.length > 0
    && (input?.changedOwnedBlocks === undefined || input?.changedOwnedBlocks === null);
  const changedOwnedBlocks = ownedBlocksUninspected
    ? [...PC_CROP_OWNED_PRISMA_BLOCKS]
    : (input?.changedOwnedBlocks ?? []).map((name) => String(name)).filter(Boolean);

  const base = {
    schemaVersion: SCHEMA_VERSION,
    eventName,
    headRef,
    exclusiveTouched,
    sharedTouched,
    governanceTouched,
    changedOwnedBlocks,
    ownedBlocksUninspected,
  };

  // An operator asking for the run by hand always gets it.
  if (eventName === 'workflow_dispatch') {
    return { ...base, applicable: true, status: 'APPLICABLE', reason: 'explicit workflow_dispatch' };
  }

  if (eventName !== 'push' && isPcCropBranch(headRef)) {
    return { ...base, applicable: true, status: 'APPLICABLE', reason: 'PC-CROP branch' };
  }

  // A push reaches here with no branch to judge, so it is decided purely on
  // content below. The one exception is a push whose diff we could not read:
  // the workflow's path filter guarantees something governed changed, so an
  // empty list means the diff is untrustworthy rather than genuinely empty.
  if (eventName === 'push' && changedFiles.length === 0) {
    return {
      ...base,
      applicable: true,
      status: 'APPLICABLE',
      reason: 'push whose changed-file set could not be resolved; assuming in scope',
    };
  }

  // Fail-closed: a foreign branch that edits the authority is still verified.
  if (exclusiveTouched.length > 0) {
    return {
      ...base,
      applicable: true,
      status: 'APPLICABLE',
      reason: `changes governed tenant-read authority files: ${exclusiveTouched.join(', ')}`,
    };
  }

  // Fail-closed on the shared schema, but only for the blocks the slice owns.
  if (changedOwnedBlocks.length > 0) {
    return {
      ...base,
      applicable: true,
      status: 'APPLICABLE',
      reason: ownedBlocksUninspected
        ? `${SHARED_SCHEMA_PATH} changed and its PC-CROP-owned blocks were not inspected; assuming in scope`
        : `changes PC-CROP-owned Prisma blocks: ${changedOwnedBlocks.join(', ')}`,
    };
  }

  let reason = 'unrelated branch touching no PC-CROP-10C governed file';
  if (sharedTouched.length > 0) {
    reason = `unrelated branch touching ${SHARED_SCHEMA_PATH} outside every PC-CROP-owned Prisma block`;
  }
  if (governanceTouched.length > 0) {
    reason = 'unrelated branch touching only PC-CROP governance files; gate integrity is checked instead of the full scope verifier';
  }

  return { ...base, applicable: false, status: 'NOT_APPLICABLE', reason };
}

/**
 * Checked whenever a non-applicable change edits the workflow or the manifest,
 * so the gate cannot be softened by a PR that then exempts itself. Also
 * asserts that the owned-block model still matches the slice's own migration.
 *
 * @returns {string[]} failures; empty means intact
 */
export function findGovernanceIntegrityFailures(root = process.cwd()) {
  const failures = [];
  const read = (relative) => {
    const absolute = path.resolve(root, relative);
    return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
  };

  const workflow = read('.github/workflows/pc-crop-10c.yml');
  if (workflow === null) {
    failures.push('.github/workflows/pc-crop-10c.yml is missing');
  } else {
    if (!workflow.includes('scripts/pc-crop-10c/verify.mjs')) {
      failures.push('workflow no longer invokes scripts/pc-crop-10c/verify.mjs');
    }
    if (/continue-on-error:\s*true/i.test(workflow)) {
      failures.push('workflow must not use continue-on-error');
    }
    if (!workflow.includes('scripts/pc-crop-10c/applicability.mjs')) {
      failures.push('workflow no longer resolves applicability before the verifier');
    }
  }

  const verifier = read('scripts/pc-crop-10c/verify.mjs');
  if (verifier === null) failures.push('scripts/pc-crop-10c/verify.mjs is missing');

  const manifestRaw = read('docs/platform-v7/autopilot/scopes/pc-crop-10c.json');
  if (manifestRaw === null) {
    failures.push('docs/platform-v7/autopilot/scopes/pc-crop-10c.json is missing');
  } else {
    let manifest;
    try {
      manifest = JSON.parse(manifestRaw);
    } catch {
      failures.push('PC-CROP-10C scope manifest is not valid JSON');
    }
    if (manifest) {
      const allowed = manifest.allowedPaths ?? [];
      const expected = [...GOVERNANCE_PATHS, ...SHARED_PATHS, ...EXCLUSIVE_PATHS].sort();
      const actual = [...allowed].sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        failures.push(
          `PC-CROP-10C scope manifest drifted: expected ${expected.length} governed paths, found ${actual.length}`,
        );
      }
    }
  }

  // The owned-block list is only trustworthy while it still describes the
  // tables this slice's own migration creates.
  const schema = read(SHARED_SCHEMA_PATH);
  const migration = read(PC_CROP_MIGRATION_PATH);
  if (schema === null) {
    failures.push(`${SHARED_SCHEMA_PATH} is missing`);
  } else if (migration !== null) {
    const blocks = extractPrismaBlocks(schema);
    for (const name of PC_CROP_OWNED_PRISMA_BLOCKS) {
      const block = blocks.get(name);
      if (block === undefined) {
        failures.push(`PC-CROP-owned Prisma block ${name} is missing from ${SHARED_SCHEMA_PATH}`);
        continue;
      }
      const mapped = /@@map\("([^"]+)"\)/.exec(block);
      if (!mapped) {
        failures.push(`PC-CROP-owned Prisma block ${name} has no @@map table name`);
        continue;
      }
      if (!migration.includes(`"${mapped[1]}"`)) {
        failures.push(
          `PC-CROP-owned Prisma block ${name} maps to ${mapped[1]}, which its own migration does not create`,
        );
      }
    }
  }

  return failures;
}

function readRevision(revision, relativePath) {
  try {
    return execFileSync('git', ['show', `${revision}:${relativePath}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function main() {
  const eventName = process.env.PC_CROP_10C_EVENT_NAME ?? '';
  const headRef = process.env.PC_CROP_10C_HEAD_REF ?? '';
  const changedFilesRaw = process.env.PC_CROP_10C_CHANGED_FILES ?? '';
  const changedFiles = changedFilesRaw.split('\n').map((line) => line.trim()).filter(Boolean);

  // Only inspect the shared schema when it actually changed, and only when the
  // workflow gave us both revisions to compare. Otherwise leave the value
  // absent so resolveApplicability falls back to its fail-closed assumption.
  let changedOwnedBlocks;
  const baseRef = process.env.PC_CROP_10C_BASE_REF ?? '';
  const headSha = process.env.PC_CROP_10C_HEAD_SHA ?? '';
  if (changedFiles.includes(SHARED_SCHEMA_PATH) && baseRef && headSha) {
    const baseSource = readRevision(baseRef, SHARED_SCHEMA_PATH);
    const headSource = readRevision(headSha, SHARED_SCHEMA_PATH);
    if (baseSource !== null && headSource !== null) {
      changedOwnedBlocks = findChangedOwnedBlocks(baseSource, headSource);
    }
  }

  const decision = resolveApplicability({ eventName, headRef, changedFiles, changedOwnedBlocks });

  // Any non-applicable change that edits governance, or that edits the shared
  // schema, must leave the gate itself intact.
  if (!decision.applicable
    && (decision.governanceTouched.length > 0 || decision.sharedTouched.length > 0)) {
    const failures = findGovernanceIntegrityFailures();
    decision.governanceIntegrity = failures.length === 0 ? 'INTACT' : 'BROKEN';
    decision.governanceIntegrityFailures = failures;
    if (failures.length > 0) {
      console.error(JSON.stringify(decision, null, 2));
      process.exit(1);
    }
  }

  console.log(JSON.stringify(decision, null, 2));

  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    fs.appendFileSync(outputPath, `applicable=${decision.applicable ? 'true' : 'false'}\n`);
    fs.appendFileSync(outputPath, `status=${decision.status}\n`);
  }
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  main();
}
