import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EXCLUSIVE_PATHS,
  GOVERNANCE_PATHS,
  PC_CROP_BRANCH_PATTERN,
  PC_CROP_MIGRATION_PATH,
  PC_CROP_OWNED_PRISMA_BLOCKS,
  SCHEMA_VERSION,
  SHARED_PATHS,
  SHARED_SCHEMA_PATH,
  extractPrismaBlocks,
  findChangedOwnedBlocks,
  findGovernanceIntegrityFailures,
  isPcCropBranch,
  resolveApplicability,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — plain ESM module, intentionally untyped
} from '../../../../scripts/pc-crop-10c/applicability.mjs';

const REPO_ROOT = resolve(__dirname, '../../../..');

const P0_BRANCH = 'p0/first-customer-access-foundation-3563';

describe('PC-CROP-10C applicability', () => {
  it('does not apply to the P0 first customer access branch', () => {
    // The concrete blocker: this branch changes ~150 files, none of which are
    // the tenant-read authority, and the gate was failing it for being
    // unrelated rather than for being unsafe.
    const decision = resolveApplicability({
      eventName: 'pull_request',
      headRef: P0_BRANCH,
      changedFiles: [
        'apps/api/src/modules/auth/auth.service.ts',
        'apps/web/app/api/auth/login/route.ts',
        '.github/workflows/pc-crop-10c.yml',
      ],
      changedOwnedBlocks: [],
    });
    expect(decision.applicable).toBe(false);
    expect(decision.status).toBe('NOT_APPLICABLE');
    expect(decision.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('applies to every PC-CROP branch prefix', () => {
    for (const branch of [
      'agent/pc-crop-10c-tenant-read',
      'fix/pc-crop-10c-grants',
      'governance/pc-crop-10c-lock',
      'ops/pc-crop-10c-rollout',
    ]) {
      expect(isPcCropBranch(branch)).toBe(true);
      expect(
        resolveApplicability({ eventName: 'pull_request', headRef: branch, changedFiles: [] }).applicable,
      ).toBe(true);
    }
  });

  it('does not treat a lookalike branch name as PC-CROP', () => {
    for (const branch of ['feature/pc-crop-10c', 'agent/pc-cropped', 'pc-crop-10c']) {
      expect(PC_CROP_BRANCH_PATTERN.test(branch)).toBe(false);
    }
  });

  describe('fail-closed: a branch name cannot buy an exemption', () => {
    it.each(EXCLUSIVE_PATHS as string[])(
      'applies when an unrelated branch touches %s',
      (governedPath) => {
        const decision = resolveApplicability({
          eventName: 'pull_request',
          headRef: P0_BRANCH,
          changedFiles: ['apps/api/src/modules/auth/auth.service.ts', governedPath],
          changedOwnedBlocks: [],
        });
        expect(decision.applicable).toBe(true);
        expect(decision.reason).toContain(governedPath);
      },
    );
  });

  describe('governance files are not subject matter', () => {
    it.each(GOVERNANCE_PATHS as string[])(
      'stays non-applicable when an unrelated branch touches only %s',
      (governancePath) => {
        const decision = resolveApplicability({
          eventName: 'pull_request',
          headRef: P0_BRANCH,
          changedFiles: [governancePath],
          changedOwnedBlocks: [],
        });
        expect(decision.applicable).toBe(false);
        expect(decision.governanceTouched).toContain(governancePath);
      },
    );

    it('reports the governance touch so the integrity check runs', () => {
      const decision = resolveApplicability({
        eventName: 'pull_request',
        headRef: P0_BRANCH,
        changedFiles: ['.github/workflows/pc-crop-10c.yml'],
        changedOwnedBlocks: [],
      });
      expect(decision.reason).toContain('gate integrity is checked');
    });
  });

  describe('the shared Prisma schema is scoped by owned block, not by path', () => {
    it('stays non-applicable when the change is outside every owned block', () => {
      // schema.prisma holds every model in the platform. Scoping it by path
      // would make essentially every PR in the monorepo a PC-CROP change.
      const decision = resolveApplicability({
        eventName: 'pull_request',
        headRef: P0_BRANCH,
        changedFiles: [SHARED_SCHEMA_PATH, 'apps/api/src/modules/auth/auth.service.ts'],
        changedOwnedBlocks: [],
      });
      expect(decision.applicable).toBe(false);
      expect(decision.sharedTouched).toContain(SHARED_SCHEMA_PATH);
      expect(decision.reason).toContain('outside every PC-CROP-owned Prisma block');
    });

    it.each(PC_CROP_OWNED_PRISMA_BLOCKS as string[])(
      'applies when an unrelated branch changes owned block %s',
      (blockName) => {
        const decision = resolveApplicability({
          eventName: 'pull_request',
          headRef: P0_BRANCH,
          changedFiles: [SHARED_SCHEMA_PATH],
          changedOwnedBlocks: [blockName],
        });
        expect(decision.applicable).toBe(true);
        expect(decision.reason).toContain(blockName);
      },
    );

    it('assumes the authority moved when the owned blocks were not inspected', () => {
      // Absence of evidence is not evidence of absence: a workflow that fails
      // to supply both revisions must not silently exempt the change.
      const decision = resolveApplicability({
        eventName: 'pull_request',
        headRef: P0_BRANCH,
        changedFiles: [SHARED_SCHEMA_PATH],
      });
      expect(decision.applicable).toBe(true);
      expect(decision.ownedBlocksUninspected).toBe(true);
      expect(decision.reason).toContain('were not inspected');
    });
  });

  describe('push to main is scoped by content, not by event', () => {
    it('applies when a push actually moves the tenant-read authority', () => {
      const decision = resolveApplicability({
        eventName: 'push',
        headRef: '',
        changedFiles: [
          'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.repository.ts',
        ],
        changedOwnedBlocks: [],
      });
      expect(decision.applicable).toBe(true);
    });

    it('applies when a push changes a PC-CROP-owned Prisma block', () => {
      const decision = resolveApplicability({
        eventName: 'push',
        headRef: '',
        changedFiles: [SHARED_SCHEMA_PATH],
        changedOwnedBlocks: ['FgisGrainTenantReadAudit'],
      });
      expect(decision.applicable).toBe(true);
    });

    it('does not apply when merging an unrelated PR replays its diff onto main', () => {
      // verify.mjs rejects every changed path outside the 15 governed ones.
      // Merging this P0 branch pushes ~150 files to main, and the gate would
      // fail main for a change it is not the authority for.
      const decision = resolveApplicability({
        eventName: 'push',
        headRef: '',
        changedFiles: [
          SHARED_SCHEMA_PATH,
          '.github/workflows/pc-crop-10c.yml',
          'apps/api/src/modules/auth/auth.service.ts',
          'apps/web/app/api/auth/login/route.ts',
        ],
        changedOwnedBlocks: [],
      });
      expect(decision.applicable).toBe(false);
      expect(decision.status).toBe('NOT_APPLICABLE');
    });

    it('applies when a push diff could not be resolved at all', () => {
      // The workflow path filter guarantees something governed changed, so an
      // empty list means the diff is untrustworthy, not genuinely empty.
      const decision = resolveApplicability({
        eventName: 'push',
        headRef: '',
        changedFiles: [],
      });
      expect(decision.applicable).toBe(true);
      expect(decision.reason).toContain('could not be resolved');
    });
  });

  it('applies on explicit workflow_dispatch', () => {
    const decision = resolveApplicability({
      eventName: 'workflow_dispatch',
      headRef: P0_BRANCH,
      changedFiles: [],
    });
    expect(decision.applicable).toBe(true);
  });

  it('treats a missing or empty changed-file list as non-applicable for a foreign branch', () => {
    for (const changedFiles of [undefined, [], ['   ', '']]) {
      const decision = resolveApplicability({
        eventName: 'pull_request',
        headRef: P0_BRANCH,
        changedFiles: changedFiles as string[] | undefined,
      });
      expect(decision.applicable).toBe(false);
    }
  });
});

describe('PC-CROP-10C owned Prisma block extraction', () => {
  const schema = readFileSync(resolve(REPO_ROOT, SHARED_SCHEMA_PATH), 'utf8');

  it('finds every owned block in the real schema', () => {
    const blocks = extractPrismaBlocks(schema);
    for (const name of PC_CROP_OWNED_PRISMA_BLOCKS as string[]) {
      expect(blocks.get(name), `${name} should be extractable`).toBeTypeOf('string');
    }
  });

  it('reports no owned-block change when the schema is unchanged', () => {
    expect(findChangedOwnedBlocks(schema, schema)).toEqual([]);
  });

  it('reports a change confined to an owned block', () => {
    const mutated = schema.replace(
      'model FgisGrainTenantReadAudit {',
      'model FgisGrainTenantReadAudit {\n  injectedForTest String?',
    );
    expect(findChangedOwnedBlocks(schema, mutated)).toEqual(['FgisGrainTenantReadAudit']);
  });

  it('reports a deleted owned block as changed', () => {
    const blocks = extractPrismaBlocks(schema);
    const removed = schema.replace(blocks.get('FgisGrainTenantReadAuditHead') as string, '');
    expect(findChangedOwnedBlocks(schema, removed)).toContain('FgisGrainTenantReadAuditHead');
  });

  it('ignores a change to an unrelated model', () => {
    // This is exactly the shape of the P0 branch's own schema change.
    const mutated = schema.replace(
      'model Organization {',
      'model Organization {\n  injectedForTest String?',
    );
    expect(findChangedOwnedBlocks(schema, mutated)).toEqual([]);
  });
});

describe('PC-CROP-10C gate integrity', () => {
  it('is intact in the current tree', () => {
    expect(findGovernanceIntegrityFailures(REPO_ROOT)).toEqual([]);
  });

  it('covers exactly the 15 paths the scope manifest governs', () => {
    const manifest = JSON.parse(
      readFileSync(
        resolve(REPO_ROOT, 'docs/platform-v7/autopilot/scopes/pc-crop-10c.json'),
        'utf8',
      ),
    );
    const declared = [...(manifest.allowedPaths as string[])].sort();
    const modelled = [...GOVERNANCE_PATHS, ...SHARED_PATHS, ...EXCLUSIVE_PATHS].sort();
    expect(declared).toEqual(modelled);
    expect(declared).toHaveLength(15);
  });

  it('detects a manifest that drifted from the governed set', () => {
    // Proves the integrity check actually fails when it should, rather than
    // being a check that can only ever pass.
    const failures = findGovernanceIntegrityFailures(
      resolve(REPO_ROOT, 'apps/api'),
    );
    expect(failures.length).toBeGreaterThan(0);
  });

  it('anchors every owned block to a table its own migration creates', () => {
    const schema = readFileSync(resolve(REPO_ROOT, SHARED_SCHEMA_PATH), 'utf8');
    const migration = readFileSync(resolve(REPO_ROOT, PC_CROP_MIGRATION_PATH), 'utf8');
    const blocks = extractPrismaBlocks(schema);
    for (const name of PC_CROP_OWNED_PRISMA_BLOCKS as string[]) {
      const mapped = /@@map\("([^"]+)"\)/.exec(blocks.get(name) as string);
      expect(mapped, `${name} must declare @@map`).not.toBeNull();
      expect(migration).toContain(`"${(mapped as RegExpExecArray)[1]}"`);
    }
  });

  it('keeps the workflow wired to both the resolver and the verifier', () => {
    const workflow = readFileSync(
      resolve(REPO_ROOT, '.github/workflows/pc-crop-10c.yml'),
      'utf8',
    );
    expect(workflow).toContain('scripts/pc-crop-10c/applicability.mjs');
    expect(workflow).toContain('scripts/pc-crop-10c/verify.mjs');
    expect(workflow).toContain('PC_CROP_10C_BASE_REF');
    expect(workflow).toContain('PC_CROP_10C_HEAD_SHA');
    expect(workflow).not.toMatch(/continue-on-error:\s*true/i);
  });
});

/**
 * CI checks out shallow and without origin/main, so this resolves to null
 * there and the live-diff assertion below skips. The logic it exercises is
 * covered unconditionally by the fixture-based cases above; this adds the
 * stronger local evidence that the resolver clears the branch as it really is.
 */
const liveMergeBase = (() => {
  try {
    return execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
})();

describe('PC-CROP-10C applicability against the real P0 diff', () => {
  // The end-to-end assertion the blocker is actually about: run the resolver
  // over this branch's true changed-file set and true schema diff.
  it.skipIf(!liveMergeBase)('resolves NOT_APPLICABLE for this branch as it really stands', () => {
    const mergeBase = liveMergeBase as string;
    const changedFiles = execFileSync('git', ['diff', '--name-only', `${mergeBase}...HEAD`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    expect(changedFiles.length).toBeGreaterThan(100);

    const show = (revision: string) => {
      try {
        return execFileSync('git', ['show', `${revision}:${SHARED_SCHEMA_PATH}`], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
        });
      } catch {
        return null;
      }
    };

    const changedOwnedBlocks = changedFiles.includes(SHARED_SCHEMA_PATH)
      ? findChangedOwnedBlocks(show(mergeBase), show('HEAD'))
      : [];
    expect(changedOwnedBlocks).toEqual([]);

    const decision = resolveApplicability({
      eventName: 'pull_request',
      headRef: P0_BRANCH,
      changedFiles,
      changedOwnedBlocks,
    });
    expect(decision.status).toBe('NOT_APPLICABLE');
    expect(decision.exclusiveTouched).toEqual([]);
  });
});
