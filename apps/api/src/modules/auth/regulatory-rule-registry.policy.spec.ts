import {
  RuleResolutionFailure,
  RuleStatus,
  type RuleVersion,
  RuleVersionDenyReason as Deny,
  evaluateRuleVersionPublication,
  resolveRuleVersion,
  ruleRevision,
} from './regulatory-rule-registry.policy';

function version(overrides: Partial<RuleVersion> = {}): RuleVersion {
  return {
    ruleKey: 'VAT_RATES',
    versionTag: '2026-01',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    status: RuleStatus.ACTIVE,
    source: 'НК РФ ст. 164',
    payload: { rates: ['10', '20'] },
    ...overrides,
  };
}

const MARCH = new Date('2026-03-15T12:00:00.000Z');

describe('the revision a document records', () => {
  it('names the rule as well as the tag', () => {
    expect(ruleRevision(version())).toBe('VAT_RATES@2026-01');
  });

  it('does not collide across rules that share a tag', () => {
    expect(ruleRevision(version({ ruleKey: 'UPD_FORMAT' }))).not.toBe(
      ruleRevision(version()),
    );
  });
});

describe('resolving the rule in force', () => {
  it('finds the open-ended version', () => {
    const r = resolveRuleVersion([version()], 'VAT_RATES', MARCH);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.revision).toBe('VAT_RATES@2026-01');
    }
  });

  it('does not resolve a rule that had not started yet', () => {
    const r = resolveRuleVersion(
      [version({ effectiveFrom: new Date('2026-06-01T00:00:00.000Z') })],
      'VAT_RATES',
      MARCH,
    );
    expect(r).toEqual({
      resolved: false,
      failure: RuleResolutionFailure.NO_VERSION_IN_FORCE,
      candidates: [],
    });
  });

  it('treats the end bound as exclusive, so a successor does not overlap it', () => {
    const boundary = new Date('2026-04-01T00:00:00.000Z');
    const older = version({
      versionTag: '2025-01',
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
      effectiveTo: boundary,
    });
    const newer = version({ versionTag: '2026-04', effectiveFrom: boundary });

    const atBoundary = resolveRuleVersion([older, newer], 'VAT_RATES', boundary);
    expect(atBoundary.resolved).toBe(true);
    if (atBoundary.resolved) {
      expect(atBoundary.version.versionTag).toBe('2026-04');
    }
  });

  it('ignores a superseded version even inside its window', () => {
    const r = resolveRuleVersion(
      [version({ status: RuleStatus.SUPERSEDED })],
      'VAT_RATES',
      MARCH,
    );
    expect(r.resolved).toBe(false);
  });

  it('ignores another rule entirely', () => {
    const r = resolveRuleVersion([version()], 'UPD_FORMAT', MARCH);
    expect(r.resolved).toBe(false);
  });

  it('reports ambiguity rather than picking the newest', () => {
    const a = version({ versionTag: '2026-01' });
    const b = version({
      versionTag: '2026-02',
      effectiveFrom: new Date('2026-02-01T00:00:00.000Z'),
    });
    const r = resolveRuleVersion([a, b], 'VAT_RATES', MARCH);
    expect(r.resolved).toBe(false);
    // Explicit comparison rather than `!r.resolved`: this package compiles
    // without `strict`, and negation does not narrow a boolean discriminant.
    if (r.resolved === false) {
      expect(r.failure).toBe(RuleResolutionFailure.AMBIGUOUS_VERSIONS);
      expect(r.candidates).toEqual(['VAT_RATES@2026-01', 'VAT_RATES@2026-02']);
    }
  });

  it('resolves a past document under the rule that governed it, not the current one', () => {
    const older = version({
      versionTag: '2025-01',
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-01-01T00:00:00.000Z'),
      payload: { rates: ['10', '20'] },
    });
    const current = version({ payload: { rates: ['5', '10', '20'] } });

    const r = resolveRuleVersion(
      [older, current],
      'VAT_RATES',
      new Date('2025-07-01T00:00:00.000Z'),
    );
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.version.versionTag).toBe('2025-01');
    }
  });
});

describe('publishing a version', () => {
  it('accepts a well-formed one', () => {
    const d = evaluateRuleVersionPublication({
      candidate: version(),
      existing: [],
    });
    expect(d).toEqual({ allowed: true, reasons: [] });
  });

  it('refuses a rule with no citation', () => {
    const d = evaluateRuleVersionPublication({
      candidate: version({ source: '   ' }),
      existing: [],
    });
    expect(d.reasons).toContain(Deny.BLANK_SOURCE);
  });

  it('refuses a blank key or tag', () => {
    expect(
      evaluateRuleVersionPublication({
        candidate: version({ ruleKey: '' }),
        existing: [],
      }).reasons,
    ).toContain(Deny.BLANK_RULE_KEY);
    expect(
      evaluateRuleVersionPublication({
        candidate: version({ versionTag: ' ' }),
        existing: [],
      }).reasons,
    ).toContain(Deny.BLANK_VERSION_TAG);
  });

  it('refuses an inverted window', () => {
    const d = evaluateRuleVersionPublication({
      candidate: version({
        effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-01-01T00:00:00.000Z'),
      }),
      existing: [],
    });
    expect(d.reasons).toContain(Deny.INVERTED_WINDOW);
  });

  it('refuses a zero-length window', () => {
    const instant = new Date('2026-06-01T00:00:00.000Z');
    const d = evaluateRuleVersionPublication({
      candidate: version({ effectiveFrom: instant, effectiveTo: instant }),
      existing: [],
    });
    expect(d.reasons).toContain(Deny.INVERTED_WINDOW);
  });

  it('refuses a payload that is not an object', () => {
    const d = evaluateRuleVersionPublication({
      candidate: version({
        payload: ['10', '20'] as unknown as Record<string, unknown>,
      }),
      existing: [],
    });
    expect(d.reasons).toContain(Deny.PAYLOAD_NOT_OBJECT);
  });

  it('refuses a tag already used for that rule', () => {
    const d = evaluateRuleVersionPublication({
      candidate: version(),
      existing: [version()],
    });
    expect(d.reasons).toContain(Deny.DUPLICATE_VERSION_TAG);
  });

  it('refuses a window that overlaps one already in force', () => {
    const d = evaluateRuleVersionPublication({
      candidate: version({
        versionTag: '2026-02',
        effectiveFrom: new Date('2026-02-01T00:00:00.000Z'),
      }),
      existing: [version()],
    });
    expect(d.reasons).toContain(Deny.OVERLAPS_EXISTING_VERSION);
  });

  it('accepts a successor that starts exactly where its predecessor ends', () => {
    const boundary = new Date('2026-04-01T00:00:00.000Z');
    const d = evaluateRuleVersionPublication({
      candidate: version({ versionTag: '2026-04', effectiveFrom: boundary }),
      existing: [version({ effectiveTo: boundary })],
    });
    expect(d.allowed).toBe(true);
  });

  it('does not treat a superseded version as occupying its window', () => {
    const d = evaluateRuleVersionPublication({
      candidate: version({ versionTag: '2026-02' }),
      existing: [version({ status: RuleStatus.SUPERSEDED })],
    });
    expect(d.reasons).not.toContain(Deny.OVERLAPS_EXISTING_VERSION);
  });

  it('leaves another rule alone', () => {
    const d = evaluateRuleVersionPublication({
      candidate: version({ ruleKey: 'UPD_FORMAT' }),
      existing: [version()],
    });
    expect(d.allowed).toBe(true);
  });

  it('reports every reason at once', () => {
    const d = evaluateRuleVersionPublication({
      candidate: version({
        source: '',
        versionTag: '',
        effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-01-01T00:00:00.000Z'),
      }),
      existing: [],
    });
    expect(d.reasons).toEqual(
      expect.arrayContaining([
        Deny.BLANK_SOURCE,
        Deny.BLANK_VERSION_TAG,
        Deny.INVERTED_WINDOW,
      ]),
    );
  });
});
