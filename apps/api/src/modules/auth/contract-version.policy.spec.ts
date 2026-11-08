import {
  ContractResolutionFailure,
  type ContractVersion,
  ContractVersionDenyReason as Deny,
  ContractVersionStatus,
  contractVersionRevision,
  evaluateContractVersionPublication,
  resolveContractVersion,
} from './contract-version.policy';

function version(overrides: Partial<ContractVersion> = {}): ContractVersion {
  return {
    contractNumber: 'ДП-2026/17',
    versionNumber: 1,
    status: ContractVersionStatus.SIGNED,
    termsHash: 'sha256-terms-1',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    signedAt: new Date('2026-01-01T00:00:00.000Z'),
    supersedesVersionNumber: null,
    ...overrides,
  };
}

const MARCH = new Date('2026-03-15T12:00:00.000Z');

describe('the revision a document records', () => {
  it('names the contract and the version', () => {
    expect(contractVersionRevision(version())).toBe('ДП-2026/17#1');
  });

  it('does not collide across contracts sharing a version number', () => {
    expect(
      contractVersionRevision(version({ contractNumber: 'ДП-2026/18' })),
    ).not.toBe(contractVersionRevision(version()));
  });
});

describe('resolving the version that governed a document', () => {
  it('finds the signed version in force', () => {
    const r = resolveContractVersion([version()], 'ДП-2026/17', MARCH);
    expect(r.resolved).toBe(true);
    if (r.resolved === true) {
      expect(r.revision).toBe('ДП-2026/17#1');
    }
  });

  it('leaves a March document under the March terms after a July amendment', () => {
    const july = new Date('2026-07-01T00:00:00.000Z');
    const first = version({ effectiveTo: july });
    const second = version({
      versionNumber: 2,
      effectiveFrom: july,
      signedAt: july,
      termsHash: 'sha256-terms-2',
      supersedesVersionNumber: 1,
    });

    const r = resolveContractVersion([first, second], 'ДП-2026/17', MARCH);
    expect(r.resolved).toBe(true);
    if (r.resolved === true) {
      expect(r.version.termsHash).toBe('sha256-terms-1');
    }
  });

  it('does not let a draft amendment govern anything', () => {
    const r = resolveContractVersion(
      [
        version({
          status: ContractVersionStatus.DRAFT,
          signedAt: null,
        }),
      ],
      'ДП-2026/17',
      MARCH,
    );
    expect(r.resolved).toBe(false);
    if (r.resolved === false) {
      expect(r.failure).toBe(ContractResolutionFailure.ONLY_UNSIGNED_VERSIONS);
      expect(r.candidates).toEqual(['ДП-2026/17#1']);
    }
  });

  it('distinguishes an unsigned proposal from no contract at all', () => {
    const draftOnly = resolveContractVersion(
      [version({ status: ContractVersionStatus.DRAFT, signedAt: null })],
      'ДП-2026/17',
      MARCH,
    );
    const nothing = resolveContractVersion([], 'ДП-2026/17', MARCH);
    expect(draftOnly.resolved).toBe(false);
    expect(nothing.resolved).toBe(false);
    if (draftOnly.resolved === false && nothing.resolved === false) {
      expect(draftOnly.failure).not.toBe(nothing.failure);
    }
  });

  it('ignores a version whose window has closed', () => {
    const r = resolveContractVersion(
      [version({ effectiveTo: new Date('2026-02-01T00:00:00.000Z') })],
      'ДП-2026/17',
      MARCH,
    );
    expect(r.resolved).toBe(false);
    if (r.resolved === false) {
      expect(r.failure).toBe(ContractResolutionFailure.NO_VERSION_IN_FORCE);
    }
  });

  it('ignores another contract', () => {
    expect(
      resolveContractVersion([version()], 'ДП-2026/99', MARCH).resolved,
    ).toBe(false);
  });

  it('reports two signed versions in force rather than picking one', () => {
    const r = resolveContractVersion(
      [version(), version({ versionNumber: 2, supersedesVersionNumber: 1 })],
      'ДП-2026/17',
      MARCH,
    );
    expect(r.resolved).toBe(false);
    if (r.resolved === false) {
      expect(r.failure).toBe(ContractResolutionFailure.AMBIGUOUS_VERSIONS);
    }
  });

  it('treats the end bound as exclusive', () => {
    const july = new Date('2026-07-01T00:00:00.000Z');
    const r = resolveContractVersion(
      [
        version({ effectiveTo: july }),
        version({
          versionNumber: 2,
          effectiveFrom: july,
          signedAt: july,
          supersedesVersionNumber: 1,
        }),
      ],
      'ДП-2026/17',
      july,
    );
    expect(r.resolved).toBe(true);
    if (r.resolved === true) {
      expect(r.version.versionNumber).toBe(2);
    }
  });
});

describe('recording a version', () => {
  it('accepts a first signed version', () => {
    expect(
      evaluateContractVersionPublication({
        candidate: version(),
        existing: [],
      }),
    ).toEqual({ allowed: true, reasons: [] });
  });

  it('accepts an amendment that names what it replaces', () => {
    const july = new Date('2026-07-01T00:00:00.000Z');
    const d = evaluateContractVersionPublication({
      candidate: version({
        versionNumber: 2,
        effectiveFrom: july,
        signedAt: july,
        supersedesVersionNumber: 1,
      }),
      existing: [version({ effectiveTo: july })],
    });
    expect(d.allowed).toBe(true);
  });

  it('refuses an amendment that names no predecessor', () => {
    const july = new Date('2026-07-01T00:00:00.000Z');
    const d = evaluateContractVersionPublication({
      candidate: version({
        versionNumber: 2,
        effectiveFrom: july,
        signedAt: july,
      }),
      existing: [version({ effectiveTo: july })],
    });
    expect(d.reasons).toContain(Deny.MISSING_SUPERSEDED_REFERENCE);
  });

  it('refuses a first version claiming to replace something', () => {
    const d = evaluateContractVersionPublication({
      candidate: version({ supersedesVersionNumber: 7 }),
      existing: [],
    });
    expect(d.reasons).toContain(Deny.SUPERSEDED_REFERENCE_ON_FIRST);
  });

  it('refuses a gap in the sequence', () => {
    const july = new Date('2026-07-01T00:00:00.000Z');
    const d = evaluateContractVersionPublication({
      candidate: version({
        versionNumber: 3,
        effectiveFrom: july,
        signedAt: july,
        supersedesVersionNumber: 1,
      }),
      existing: [version({ effectiveTo: july })],
    });
    expect(d.reasons).toContain(Deny.VERSION_NOT_SEQUENTIAL);
  });

  it('refuses a reused version number', () => {
    const d = evaluateContractVersionPublication({
      candidate: version({ termsHash: 'sha256-other' }),
      existing: [version()],
    });
    expect(d.reasons).toContain(Deny.DUPLICATE_VERSION_NUMBER);
  });

  it('refuses replacing a version that was never signed', () => {
    const july = new Date('2026-07-01T00:00:00.000Z');
    const d = evaluateContractVersionPublication({
      candidate: version({
        versionNumber: 2,
        effectiveFrom: july,
        signedAt: july,
        supersedesVersionNumber: 1,
      }),
      existing: [
        version({
          status: ContractVersionStatus.DRAFT,
          signedAt: null,
          effectiveTo: july,
        }),
      ],
    });
    expect(d.reasons).toContain(Deny.SUPERSEDES_UNSIGNED_VERSION);
  });

  it('refuses replacing a version that does not exist', () => {
    const july = new Date('2026-07-01T00:00:00.000Z');
    const d = evaluateContractVersionPublication({
      candidate: version({
        versionNumber: 2,
        effectiveFrom: july,
        signedAt: july,
        supersedesVersionNumber: 9,
      }),
      existing: [version({ effectiveTo: july })],
    });
    expect(d.reasons).toContain(Deny.SUPERSEDES_UNKNOWN_VERSION);
  });

  it('refuses two signed versions in force at once', () => {
    const d = evaluateContractVersionPublication({
      candidate: version({ versionNumber: 2, supersedesVersionNumber: 1 }),
      existing: [version()],
    });
    expect(d.reasons).toContain(Deny.OVERLAPS_SIGNED_VERSION);
  });

  it('lets a draft amendment sit alongside the signed version it will replace', () => {
    const d = evaluateContractVersionPublication({
      candidate: version({
        versionNumber: 2,
        status: ContractVersionStatus.DRAFT,
        signedAt: null,
        supersedesVersionNumber: 1,
      }),
      existing: [version()],
    });
    expect(d.allowed).toBe(true);
  });

  it('refuses a signed status with no timestamp', () => {
    const d = evaluateContractVersionPublication({
      candidate: version({ signedAt: null }),
      existing: [],
    });
    expect(d.reasons).toContain(Deny.SIGNED_WITHOUT_TIMESTAMP);
  });

  it('refuses a draft carrying a signature time', () => {
    const d = evaluateContractVersionPublication({
      candidate: version({ status: ContractVersionStatus.DRAFT }),
      existing: [],
    });
    expect(d.reasons).toContain(Deny.UNSIGNED_WITH_TIMESTAMP);
  });

  it('refuses a blank terms hash', () => {
    const d = evaluateContractVersionPublication({
      candidate: version({ termsHash: '  ' }),
      existing: [],
    });
    expect(d.reasons).toContain(Deny.BLANK_TERMS_HASH);
  });

  it('refuses a non-positive version number', () => {
    const d = evaluateContractVersionPublication({
      candidate: version({ versionNumber: 0 }),
      existing: [],
    });
    expect(d.reasons).toContain(Deny.NON_POSITIVE_VERSION);
  });

  it('leaves another contract alone', () => {
    const d = evaluateContractVersionPublication({
      candidate: version({ contractNumber: 'ДП-2026/18' }),
      existing: [version()],
    });
    expect(d.allowed).toBe(true);
  });

  it('reports every reason at once', () => {
    const d = evaluateContractVersionPublication({
      candidate: version({
        versionNumber: 5,
        termsHash: '',
        signedAt: null,
        supersedesVersionNumber: null,
      }),
      existing: [version()],
    });
    expect(d.reasons).toEqual(
      expect.arrayContaining([
        Deny.BLANK_TERMS_HASH,
        Deny.SIGNED_WITHOUT_TIMESTAMP,
        Deny.VERSION_NOT_SEQUENTIAL,
        Deny.MISSING_SUPERSEDED_REFERENCE,
      ]),
    );
  });
});
