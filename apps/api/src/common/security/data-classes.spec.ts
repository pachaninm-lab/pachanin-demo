import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DATA_CLASS_IDS,
  NEVER_QUERY_STRING_CLASSES,
  OUTBOUND_REDACTED_CLASSES,
  PROHIBITED_CLASSES,
  isOutboundRedacted,
} from './data-classes';
import {
  REDACTED,
  SENSITIVE_FIELD_CLASSES,
  SENSITIVE_FIELD_NAMES,
  SENSITIVE_VALUE_RULES,
  dataClassForField,
  maskDeep,
  maskQueryString,
} from './sensitive-data';
import { scrubSentryEvent } from '../../sentry';

const CANONICAL = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'docs', 'security', 'data-classification.json'), 'utf8'),
);

describe('canonical classification is the source of truth', () => {
  // The owner approved the schema in docs. The code mirrors it, and these two
  // must not drift: a class added to the policy and forgotten in code, or the
  // reverse, fails here rather than silently leaving a gap.
  it('mirrors the approved class list exactly, in order', () => {
    expect(DATA_CLASS_IDS).toEqual(CANONICAL.classes.map((c: any) => c.id));
  });

  it('mirrors which classes are prohibited in the current scope', () => {
    const prohibited = CANONICAL.classes.filter((c: any) => c.prohibited).map((c: any) => c.id);
    expect([...PROHIBITED_CLASSES]).toEqual(prohibited);
  });

  it('redacts outbound exactly the classes the policy says to redact outbound', () => {
    const fromPolicy = CANONICAL.classes
      .filter((c: any) => c.handling?.redactOutbound)
      .map((c: any) => c.id);
    expect([...OUTBOUND_REDACTED_CLASSES]).toEqual(fromPolicy);
  });

  it('keeps out of the query string exactly the classes the policy names', () => {
    const fromPolicy = CANONICAL.classes
      .filter((c: any) => c.handling?.neverQueryString)
      .map((c: any) => c.id);
    expect([...NEVER_QUERY_STRING_CLASSES]).toEqual(fromPolicy);
  });

  it('records the open items rather than pretending the policy is complete', () => {
    expect(CANONICAL.openItems.length).toBeGreaterThan(0);
  });
});

describe('every classified term maps to exactly one canonical class', () => {
  it('gives every sensitive field name a class that exists', () => {
    for (const name of SENSITIVE_FIELD_NAMES) {
      const id = SENSITIVE_FIELD_CLASSES[name];
      expect({ name, id }).toEqual({ name, id: expect.any(String) });
      expect(DATA_CLASS_IDS).toContain(id);
    }
  });

  it('gives every value rule a class that exists', () => {
    for (const rule of SENSITIVE_VALUE_RULES) {
      expect(DATA_CLASS_IDS).toContain(rule.dataClass);
    }
  });

  it('resolves a class through normalization, not only the exact key', () => {
    expect(dataClassForField('Set-Cookie')).toBe('C10_AUTH_SECRET');
    expect(dataClassForField('bank_account')).toBe('C6_PD_FINANCIAL');
    expect(dataClassForField('dealId')).toBeNull();
  });
});

describe('no canonical class is dropped by a downstream control', () => {
  // This is the requirement the owner stated directly: no downstream control
  // may miss a canonical class because its own terminology differs. Each
  // outbound-redacted class must be represented by at least one term, and
  // every term of that class must actually be redacted on every outbound
  // surface — asserted per class, so a class with no coverage fails loudly.
  const classesWithTerms = new Set([
    ...Object.values(SENSITIVE_FIELD_CLASSES),
    ...SENSITIVE_VALUE_RULES.map((rule) => rule.dataClass),
  ]);

  it('covers every outbound-redacted class with at least one term', () => {
    const uncovered = OUTBOUND_REDACTED_CLASSES.filter((id) => !classesWithTerms.has(id));
    // C8 and C9 are prohibited classes: no term should exist for data the
    // product must not process. They are excluded deliberately and by name.
    expect(uncovered).toEqual(['C8_PD_SPECIAL', 'C9_PD_BIOMETRIC']);
  });

  it('redacts every term of every outbound-redacted class in the request body', () => {
    for (const [name, id] of Object.entries(SENSITIVE_FIELD_CLASSES)) {
      if (!isOutboundRedacted(id)) continue;
      const event: any = { request: { data: { [name]: 'leak-me' } } };
      scrubSentryEvent(event);
      expect({ name, id, value: event.request.data[name] }).toEqual({ name, id, value: REDACTED });
    }
  });

  it('redacts every term of every outbound-redacted class in headers', () => {
    for (const [name, id] of Object.entries(SENSITIVE_FIELD_CLASSES)) {
      if (!isOutboundRedacted(id)) continue;
      const event: any = { request: { headers: { [name]: 'leak-me' } } };
      scrubSentryEvent(event);
      expect(event.request.headers[name]).toBe(REDACTED);
    }
  });

  it('keeps every never-query-string class out of the query string', () => {
    for (const [name, id] of Object.entries(SENSITIVE_FIELD_CLASSES)) {
      if (!NEVER_QUERY_STRING_CLASSES.includes(id)) continue;
      expect(maskQueryString(`${name}=leak-me&page=2`)).toBe(`${name}=${REDACTED}&page=2`);
    }
  });

  it('redacts every term internally as well, so the two channels agree', () => {
    for (const [name, id] of Object.entries(SENSITIVE_FIELD_CLASSES)) {
      if (!isOutboundRedacted(id)) continue;
      expect(maskDeep({ [name]: 'leak-me' })).toEqual({ [name]: REDACTED });
    }
  });
});

describe('legal-entity codes are business confidential, and now redacted outbound too', () => {
  it('classifies the legal-entity codes as business confidential, not as personal data', () => {
    // The owner's financial rule: legal-entity data with no link to a natural
    // person is C2. BIK identifies a bank and KPP identifies an organisation.
    expect(dataClassForField('bik')).toBe('C2_BUSINESS_CONFIDENTIAL');
    expect(dataClassForField('kpp')).toBe('C2_BUSINESS_CONFIDENTIAL');
  });

  it('still masks the BIK value pattern in text, because it travels with account data', () => {
    expect(maskDeep({ note: 'BIK 044525225' })).toEqual({ note: 'BIK 04*******' });
  });

  // C2 was not outbound-redacted when the classification first merged; the
  // data-protection-requirements decision added an outbound rule for it.
  // These two terms are the load-bearing proof that the addition actually
  // took effect, not just that the policy document changed.
  it('now redacts BIK and KPP from outbound telemetry as well', () => {
    const event: any = { request: { data: { bik: 'leak-me', kpp: 'leak-me' } } };
    scrubSentryEvent(event);
    expect(event.request.data.bik).toBe(REDACTED);
    expect(event.request.data.kpp).toBe(REDACTED);
  });
});

describe('retention, database encryption and integrity are documented for every class', () => {
  it('gives every class a retention entry with a requirement, a basis and an enforcement statement', () => {
    for (const c of CANONICAL.classes as any[]) {
      expect(c.retention).toBeDefined();
      expect(typeof c.retention.requirement).toBe('string');
      expect(c.retention.requirement.length).toBeGreaterThan(0);
      expect(typeof c.retention.basis).toBe('string');
      expect(typeof c.retention.enforcement).toBe('string');
    }
  });

  it('gives every class a database-encryption entry with a requirement and an enforcement statement', () => {
    for (const c of CANONICAL.classes as any[]) {
      expect(c.databaseEncryption).toBeDefined();
      expect(typeof c.databaseEncryption.requirement).toBe('string');
      expect(typeof c.databaseEncryption.enforcement).toBe('string');
    }
  });

  it('gives every class an integrity-verification entry with a requirement and an enforcement statement', () => {
    for (const c of CANONICAL.classes as any[]) {
      expect(c.integrityVerification).toBeDefined();
      expect(typeof c.integrityVerification.requirement).toBe('string');
      expect(typeof c.integrityVerification.enforcement).toBe('string');
    }
  });

  it('does not silently drop a class from the mirrored code binding', () => {
    // The outbound rule for C2 exists in the schema (handling.redactOutbound)
    // and must therefore exist in the code that reads the schema.
    const c2 = (CANONICAL.classes as any[]).find((c) => c.id === 'C2_BUSINESS_CONFIDENTIAL');
    expect(c2.handling.redactOutbound).toBe(true);
    expect(isOutboundRedacted('C2_BUSINESS_CONFIDENTIAL')).toBe(true);
  });

  it('keeps the two prohibited classes not-applicable across all three requirement dimensions', () => {
    for (const id of ['C8_PD_SPECIAL', 'C9_PD_BIOMETRIC']) {
      const c = (CANONICAL.classes as any[]).find((x) => x.id === id);
      expect(c.retention.enforcement).toBe('not-applicable');
      expect(c.databaseEncryption.enforcement).toBe('not-applicable');
      expect(c.integrityVerification.enforcement).toBe('not-applicable');
    }
  });

  it('distinguishes documentation completeness from enforcement completeness in its own text', () => {
    expect(CANONICAL.protectionRequirementsNote).toMatch(/does not.*close any requirement.*enforc/su);
  });

  it('records what was closed by this decision without erasing what remains open', () => {
    expect(CANONICAL.closedItems.length).toBeGreaterThanOrEqual(4);
    expect(CANONICAL.openItems.length).toBeGreaterThan(0);
  });
});

describe('enforcement citations name real code, and stay true to it', () => {
  // Every enforcement claim that names a file is checked against that file's
  // actual content here. A citation that goes stale because the code moved
  // fails this test rather than sitting unnoticed in a JSON string forever.
  const API_ROOT = join(__dirname, '..', '..', '..');
  const read = (relative: string) => readFileSync(join(API_ROOT, relative), 'utf8');

  it('C4 token lifetimes: the cited constants exist with the cited values', () => {
    const accessToken = read('src/modules/auth/access-token.ts');
    expect(accessToken).toContain("ACCESS_TOKEN_TTL = '15m'");
    const authService = read('src/modules/auth/auth.service.ts');
    expect(authService).toContain('SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000');
    expect(authService).toContain('REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000');
  });

  it('C3 phone encryption: AES-256-GCM is really used in the cited module', () => {
    const phoneService = read('src/modules/gekta/gekta-phone.service.ts');
    expect(phoneService.toLowerCase()).toContain('aes-256-gcm');
  });

  it('C10 MFA secret encryption: AES-256-GCM is really used in the cited module', () => {
    const authCrypto = read('src/modules/auth/auth-crypto.ts');
    expect(authCrypto.toLowerCase()).toContain('aes-256-gcm');
  });

  it('C5 identity gap: GektaMerchantProfile.inn is really unencrypted VarChar in the schema', () => {
    const schema = readFileSync(join(API_ROOT, 'prisma', 'schema.prisma'), 'utf8');
    const model = schema.slice(schema.indexOf('model GektaMerchantProfile'));
    const field = model.slice(0, model.indexOf('\n}'));
    expect(field).toMatch(/inn\s+String\?\s+@db\.VarChar/);
  });

  it('C11 key material: no key-bearing column exists, only a reference', () => {
    const schema = readFileSync(join(API_ROOT, 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toContain('signingKeyReference');
    expect(schema).not.toMatch(/\b(encryptionKey|privateKey|signingKey)\s+String/);
  });

  it('C2/C6/C7 integrity: the evidence-pack hash chain is real and actually verified, not write-only', () => {
    const evidencePack = read('src/modules/evidence-pack/evidence-pack.service.ts');
    expect(evidencePack).toContain('prevHash');
    expect(evidencePack).toMatch(/createHash\(['"]sha256['"]\)/);
    expect(evidencePack).toContain('verifyChain');
    // Not just declared: called from somewhere other than its own declaration.
    const calls = evidencePack.split('verifyChain(').length - 1;
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('C2 contract integrity: a signed version is documented as immutable', () => {
    const contractVersion = read('src/modules/auth/contract-version.policy.ts');
    expect(contractVersion).toMatch(/immutable/i);
    expect(contractVersion).toContain('SIGNED');
    expect(contractVersion).toContain('SUPERSEDED');
  });

  it('C2 accounting-linked retention basis: the auth-mail retention job this pattern is modelled on is real', () => {
    // Not the same class, but the proof that a real per-row retention job
    // pattern already exists in this codebase, which is why "not-enforced"
    // for the PD classes is stated as a gap rather than an impossibility.
    const worker = read('src/auth-mail-worker.ts');
    expect(worker).toContain('AUTH_MAIL_RETENTION_DAYS');
    expect(worker).toContain('DEFAULT_RETENTION_DAYS');
  });
});

describe('the policy document and the machine-readable schema agree', () => {
  const POLICY = readFileSync(
    join(__dirname, '..', '..', '..', '..', '..', 'docs', 'security', 'DATA_CLASSIFICATION.md'),
    'utf8',
  );

  it('documents every canonical class', () => {
    const undocumented = DATA_CLASS_IDS.filter((id) => !POLICY.includes(id));
    expect(undocumented).toEqual([]);
  });

  it('states every open item, so the policy is not read as complete', () => {
    // Compared verbatim rather than by prose heuristic: an open item that is
    // reworded in one place and not the other is exactly the drift worth
    // catching, and a fuzzy match would hide it.
    for (const item of CANONICAL.openItems as string[]) {
      expect({ item, documented: POLICY.includes(item) }).toEqual({ item, documented: true });
    }
  });

  it('names the two prohibited classes as prohibited in the document', () => {
    expect(POLICY).toMatch(/C8_PD_SPECIAL.*prohibited/su);
    expect(POLICY).toMatch(/C9_PD_BIOMETRIC.*prohibited/su);
  });
});
