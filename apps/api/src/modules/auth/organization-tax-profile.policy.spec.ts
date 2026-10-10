import {
  TaxProfileDenyReason as ProfileDeny,
  TaxProfileResolutionFailure,
  type TaxProfileVersion,
  TaxRegime,
  TaxTreatmentDenyReason as Deny,
  VatStatus,
  evaluateDocumentTaxTreatment,
  evaluateTaxProfilePublication,
  resolveTaxProfile,
  taxProfileRevision,
} from './organization-tax-profile.policy';

function profile(overrides: Partial<TaxProfileVersion> = {}): TaxProfileVersion {
  return {
    organizationId: 'org-a',
    versionTag: '2026-01',
    taxRegime: TaxRegime.OSNO,
    vatStatus: VatStatus.PAYER,
    vatExemptionGround: null,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    ...overrides,
  };
}

const EXEMPT = profile({
  taxRegime: TaxRegime.ESHN,
  vatStatus: VatStatus.EXEMPT,
  vatExemptionGround: 'ст. 145 НК РФ',
});

const NOT_PAYER = profile({
  taxRegime: TaxRegime.USN,
  vatStatus: VatStatus.NOT_PAYER,
});

const MARCH = new Date('2026-03-15T12:00:00.000Z');
const RATES = ['10', '20'];

function treatment(overrides: Record<string, unknown> = {}) {
  return evaluateDocumentTaxTreatment({
    profile: profile(),
    ratesInForce: RATES,
    statedRate: '10',
    vatAmountKopecks: 1_250_000n,
    taxableBaseKopecks: 12_500_000n,
    ...overrides,
  } as Parameters<typeof evaluateDocumentTaxTreatment>[0]);
}

describe('the revision a document records', () => {
  it('names the organization as well as the tag', () => {
    expect(taxProfileRevision(profile())).toBe('org-a@2026-01');
  });

  it('does not collide across organizations sharing a tag', () => {
    expect(taxProfileRevision(profile({ organizationId: 'org-b' }))).not.toBe(
      taxProfileRevision(profile()),
    );
  });
});

describe('resolving the profile in force', () => {
  it('finds the current one', () => {
    const r = resolveTaxProfile([profile()], 'org-a', MARCH);
    expect(r.resolved).toBe(true);
    if (r.resolved === true) {
      expect(r.revision).toBe('org-a@2026-01');
    }
  });

  it('does not resolve another organization', () => {
    expect(resolveTaxProfile([profile()], 'org-b', MARCH).resolved).toBe(false);
  });

  it('leaves a March document under the March status after a July change', () => {
    const july = new Date('2026-07-01T00:00:00.000Z');
    const before = profile({ versionTag: '2026-01', effectiveTo: july });
    const after = profile({
      versionTag: '2026-07',
      effectiveFrom: july,
      taxRegime: TaxRegime.ESHN,
      vatStatus: VatStatus.EXEMPT,
      vatExemptionGround: 'ст. 145 НК РФ',
    });

    const r = resolveTaxProfile([before, after], 'org-a', MARCH);
    expect(r.resolved).toBe(true);
    if (r.resolved === true) {
      expect(r.profile.vatStatus).toBe(VatStatus.PAYER);
    }
  });

  it('treats the end bound as exclusive', () => {
    const july = new Date('2026-07-01T00:00:00.000Z');
    const r = resolveTaxProfile(
      [
        profile({ versionTag: '2026-01', effectiveTo: july }),
        profile({ versionTag: '2026-07', effectiveFrom: july }),
      ],
      'org-a',
      july,
    );
    expect(r.resolved).toBe(true);
    if (r.resolved === true) {
      expect(r.profile.versionTag).toBe('2026-07');
    }
  });

  it('reports ambiguity rather than picking one', () => {
    const r = resolveTaxProfile(
      [profile({ versionTag: 'a' }), profile({ versionTag: 'b' })],
      'org-a',
      MARCH,
    );
    expect(r.resolved).toBe(false);
    if (r.resolved === false) {
      expect(r.failure).toBe(TaxProfileResolutionFailure.AMBIGUOUS_PROFILES);
      expect(r.candidates).toEqual(['org-a@a', 'org-a@b']);
    }
  });

  it('reports no profile rather than assuming a default', () => {
    const r = resolveTaxProfile([], 'org-a', MARCH);
    expect(r.resolved).toBe(false);
    if (r.resolved === false) {
      expect(r.failure).toBe(TaxProfileResolutionFailure.NO_PROFILE_IN_FORCE);
    }
  });
});

describe('what a document may claim about VAT', () => {
  it('lets a payer state a rate the rule version lists', () => {
    const d = treatment();
    expect(d.allowed).toBe(true);
    expect(d.vatLine).toBe('НДС 10%');
  });

  it('refuses a rate the rule version does not list', () => {
    expect(treatment({ statedRate: '18' }).reasons).toContain(
      Deny.RATE_NOT_IN_FORCE,
    );
  });

  it('treats an empty rate list as nothing lawful, not as anything goes', () => {
    const d = treatment({ ratesInForce: [] });
    expect(d.allowed).toBe(false);
    expect(d.reasons).toContain(Deny.RATE_NOT_IN_FORCE);
  });

  it('refuses a payer document with no VAT stated', () => {
    const d = treatment({ statedRate: null, vatAmountKopecks: null });
    expect(d.reasons).toContain(Deny.VAT_MISSING_FOR_PAYER);
  });

  it('refuses to proceed with no profile rather than assuming a default', () => {
    const d = treatment({ profile: null });
    expect(d.reasons).toEqual([Deny.NO_TAX_PROFILE]);
  });

  it('refuses to proceed when no rule version resolved', () => {
    const d = treatment({ ratesInForce: null });
    expect(d.reasons).toEqual([Deny.RULE_VERSION_MISSING]);
  });

  describe('an organization that does not charge VAT', () => {
    it('prints без НДС with the ground when exempt', () => {
      const d = treatment({
        profile: EXEMPT,
        statedRate: null,
        vatAmountKopecks: 0n,
      });
      expect(d.allowed).toBe(true);
      expect(d.vatLine).toBe('Без НДС (ст. 145 НК РФ)');
    });

    it('prints без НДС with no ground when simply not a payer', () => {
      const d = treatment({
        profile: NOT_PAYER,
        statedRate: null,
        vatAmountKopecks: null,
      });
      expect(d.allowed).toBe(true);
      expect(d.vatLine).toBe('Без НДС');
    });

    it('refuses it charging VAT', () => {
      const d = treatment({
        profile: NOT_PAYER,
        statedRate: null,
        vatAmountKopecks: 1_250_000n,
      });
      expect(d.reasons).toContain(Deny.VAT_CHARGED_WITHOUT_STATUS);
    });

    it('refuses it stating a rate', () => {
      const d = treatment({
        profile: EXEMPT,
        statedRate: '10',
        vatAmountKopecks: 0n,
      });
      expect(d.reasons).toContain(Deny.RATE_STATED_WITHOUT_STATUS);
    });

    it('refuses an exemption with no ground recorded', () => {
      const d = treatment({
        profile: profile({
          vatStatus: VatStatus.EXEMPT,
          vatExemptionGround: '  ',
        }),
        statedRate: null,
        vatAmountKopecks: null,
      });
      expect(d.reasons).toContain(Deny.MISSING_EXEMPTION_GROUND);
    });

    it('refuses a non-payer claiming an exemption it does not hold', () => {
      const d = treatment({
        profile: profile({
          vatStatus: VatStatus.NOT_PAYER,
          vatExemptionGround: 'ст. 145 НК РФ',
        }),
        statedRate: null,
        vatAmountKopecks: null,
      });
      expect(d.reasons).toContain(Deny.EXEMPTION_GROUND_ON_NON_EXEMPT);
    });
  });

  describe('money', () => {
    it('accepts a correction carrying a negative base and a negative VAT', () => {
      const d = treatment({
        vatAmountKopecks: -1_250_000n,
        taxableBaseKopecks: -12_500_000n,
      });
      expect(d.allowed).toBe(true);
    });

    it('refuses a negative VAT on a positive base', () => {
      const d = treatment({
        vatAmountKopecks: -1_250_000n,
        taxableBaseKopecks: 12_500_000n,
      });
      expect(d.reasons).toContain(Deny.NEGATIVE_VAT_ON_POSITIVE_BASE);
    });

    it('treats a zero VAT amount from a payer as no VAT charged', () => {
      const d = treatment({ vatAmountKopecks: 0n });
      expect(d.allowed).toBe(true);
    });
  });

  it('reports every reason at once', () => {
    const d = treatment({
      profile: profile({
        vatStatus: VatStatus.NOT_PAYER,
        vatExemptionGround: 'invented',
      }),
      statedRate: '18',
      vatAmountKopecks: 1_250_000n,
    });
    expect(d.reasons).toEqual(
      expect.arrayContaining([
        Deny.VAT_CHARGED_WITHOUT_STATUS,
        Deny.RATE_STATED_WITHOUT_STATUS,
        Deny.EXEMPTION_GROUND_ON_NON_EXEMPT,
      ]),
    );
  });
});

describe('recording a profile version', () => {
  it('accepts a well-formed one', () => {
    expect(
      evaluateTaxProfilePublication({ candidate: profile(), existing: [] }),
    ).toEqual({ allowed: true, reasons: [] });
  });

  it('refuses two statuses in force at once', () => {
    const d = evaluateTaxProfilePublication({
      candidate: profile({ versionTag: '2026-06' }),
      existing: [profile()],
    });
    expect(d.reasons).toContain(ProfileDeny.OVERLAPS_EXISTING_PROFILE);
  });

  it('accepts a successor starting where its predecessor ends', () => {
    const july = new Date('2026-07-01T00:00:00.000Z');
    const d = evaluateTaxProfilePublication({
      candidate: profile({ versionTag: '2026-07', effectiveFrom: july }),
      existing: [profile({ effectiveTo: july })],
    });
    expect(d.allowed).toBe(true);
  });

  it('leaves another organization alone', () => {
    const d = evaluateTaxProfilePublication({
      candidate: profile({ organizationId: 'org-b' }),
      existing: [profile()],
    });
    expect(d.allowed).toBe(true);
  });

  it('refuses a duplicate tag', () => {
    const d = evaluateTaxProfilePublication({
      candidate: profile({ effectiveFrom: new Date('2030-01-01T00:00:00.000Z') }),
      existing: [profile({ effectiveTo: new Date('2027-01-01T00:00:00.000Z') })],
    });
    expect(d.reasons).toContain(ProfileDeny.DUPLICATE_VERSION_TAG);
  });

  it('refuses an inverted window', () => {
    const d = evaluateTaxProfilePublication({
      candidate: profile({
        effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-01-01T00:00:00.000Z'),
      }),
      existing: [],
    });
    expect(d.reasons).toContain(ProfileDeny.INVERTED_WINDOW);
  });

  it('refuses an exemption with no ground', () => {
    const d = evaluateTaxProfilePublication({
      candidate: profile({ vatStatus: VatStatus.EXEMPT }),
      existing: [],
    });
    expect(d.reasons).toContain(ProfileDeny.MISSING_EXEMPTION_GROUND);
  });

  it('refuses a ground on a status that is not exempt', () => {
    const d = evaluateTaxProfilePublication({
      candidate: profile({ vatExemptionGround: 'ст. 145 НК РФ' }),
      existing: [],
    });
    expect(d.reasons).toContain(ProfileDeny.EXEMPTION_GROUND_ON_NON_EXEMPT);
  });
});
