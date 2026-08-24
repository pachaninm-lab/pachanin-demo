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

describe('classes that are not outbound-redacted are not silently treated as safe', () => {
  it('classifies the legal-entity codes as business confidential, not as personal data', () => {
    // The owner's financial rule: legal-entity data with no link to a natural
    // person is C2. BIK identifies a bank and KPP identifies an organisation.
    expect(dataClassForField('bik')).toBe('C2_BUSINESS_CONFIDENTIAL');
    expect(dataClassForField('kpp')).toBe('C2_BUSINESS_CONFIDENTIAL');
  });

  it('still masks the BIK value pattern in text, because it travels with account data', () => {
    expect(maskDeep({ note: 'BIK 044525225' })).toEqual({ note: 'BIK 04*******' });
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
