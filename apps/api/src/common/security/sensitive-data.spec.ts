import {
  REDACTED,
  SENSITIVE_FIELD_NAMES,
  SENSITIVE_VALUE_RULES,
  isSensitiveFieldName,
  maskDeep,
  maskQueryString,
  maskText,
} from './sensitive-data';
import { scrubSentryEvent } from '../../sentry';
import { LogMaskingMiddleware } from '../middleware/log-masking.middleware';

/**
 * Один пример на каждый шаблон значений. Тест ниже проверяет, что карта
 * покрывает шаблоны целиком: новый шаблон без примера роняет сборку, а не
 * проходит без проверки.
 */
const VALUE_SAMPLES: Record<string, string> = {
  'inn-12': '770123456789',
  'ogrn-15': '304500116000157',
  bik: '044525225',
  'bank-account': '40702810900000012345',
  'phone-ru': '+7 916 123-45-67',
  email: 'ivan.petrov@example.com',
  'email-short-local': 'q@example.org',
  'card-number': '4276 3801 1234 5678',
  'passport-ru': '4509 123456',
};

const SECRET = 'super-secret-value-do-not-leak';

describe('sensitive-data classification', () => {
  it('has a sample for every value rule, so no rule ships unverified', () => {
    expect(Object.keys(VALUE_SAMPLES).sort())
      .toEqual(SENSITIVE_VALUE_RULES.map((rule) => rule.name).sort());
  });

  it('masks every value sample', () => {
    for (const [rule, sample] of Object.entries(VALUE_SAMPLES)) {
      expect(maskText(sample)).not.toBe(sample);
      expect(maskText(`payload=${sample}`)).not.toContain(sample);
      expect(rule).toBeTruthy();
    }
  });

  // The main email rule needs at least two characters before the @, so a
  // one-character address matched nothing at all and travelled unmasked on
  // every channel, the Sentry outbound one included. Partial masking cannot
  // help there: the prefix the rule would keep is the whole local part.
  describe('email local part shorter than the retained prefix', () => {
    it.each(['a@b.co', 'x@mail.ru', 'q@example.org', 'user q@example.org wrote'])(
      'removes the local part entirely: %s',
      (sample) => {
        const masked = maskText(sample);
        expect(masked).toContain('***@');
        expect(masked).not.toMatch(/(^|[^*])[a-zA-Z0-9._%+-]@/u);
      },
    );

    it('keeps the domain, like every other rule here', () => {
      expect(maskText('a@b.co')).toBe('***@b.co');
      expect(maskText('x@mail.ru')).toBe('***@mail.ru');
    });

    it('does not disturb a longer local part', () => {
      // Ordering matters: placed before the main rule, this one would strip the
      // last character of a long local part instead of leaving it to that rule.
      expect(maskText('ab@b.co')).toBe('a***@b.co');
      expect(maskText('abcde@example.com')).toBe('abc***@example.com');
      expect(maskText('ivan.petrov@example.com')).toBe('iva***@example.com');
      expect(maskText('a.b@x.com')).toBe('a.***@x.com');
      expect(maskText('user_1@sub.domain.co.uk')).toBe('use***@sub.domain.co.uk');
    });
  });

  it('is insensitive to case and to separators in field names', () => {
    expect(isSensitiveFieldName('Set-Cookie')).toBe(true);
    expect(isSensitiveFieldName('set_cookie')).toBe(true);
    expect(isSensitiveFieldName('setCookie')).toBe(true);
    expect(isSensitiveFieldName('AUTHORIZATION')).toBe(true);
  });

  it('matches field names exactly rather than by substring', () => {
    // Substring matching would redact these and create a false sense of
    // coverage while telling us nothing about the real fields.
    expect(isSensitiveFieldName('tokenCount')).toBe(false);
    expect(isSensitiveFieldName('emailVerifiedAt')).toBe(false);
    expect(isSensitiveFieldName('dealId')).toBe(false);
  });

  it('redacts every classified field name, nested as well as at the top', () => {
    for (const field of SENSITIVE_FIELD_NAMES) {
      expect(maskDeep({ [field]: SECRET })).toEqual({ [field]: REDACTED });
      const nested = maskDeep({ a: { b: [{ [field]: SECRET }] } }) as any;
      expect(nested.a.b[0][field]).toBe(REDACTED);
    }
  });
});

describe('outbound telemetry is not weaker than internal logging', () => {
  // This is the whole point of the suite. The two channels used to carry
  // different classifications and the weaker one faced outward. These tests
  // derive their cases from the shared list, so adding a class to the
  // classification and forgetting the Sentry scrubber fails here.
  it('redacts every classified field in the request body', () => {
    for (const field of SENSITIVE_FIELD_NAMES) {
      const event: any = { request: { data: { [field]: SECRET } } };
      scrubSentryEvent(event);
      expect(event.request.data[field]).toBe(REDACTED);
    }
  });

  it('redacts every classified field in request headers', () => {
    for (const field of SENSITIVE_FIELD_NAMES) {
      const event: any = { request: { headers: { [field]: SECRET } } };
      scrubSentryEvent(event);
      expect(event.request.headers[field]).toBe(REDACTED);
    }
  });

  it('redacts every classified field in extra, contexts and tags', () => {
    for (const field of SENSITIVE_FIELD_NAMES) {
      const event: any = {
        extra: { [field]: SECRET },
        contexts: { anything: { [field]: SECRET } },
        tags: { [field]: SECRET },
      };
      scrubSentryEvent(event);
      expect(event.extra[field]).toBe(REDACTED);
      expect(event.contexts.anything[field]).toBe(REDACTED);
      expect(event.tags[field]).toBe(REDACTED);
    }
  });

  it('redacts every classified field in breadcrumb data', () => {
    for (const field of SENSITIVE_FIELD_NAMES) {
      const event: any = { breadcrumbs: [{ message: 'x', data: { [field]: SECRET } }] };
      scrubSentryEvent(event);
      expect(event.breadcrumbs[0].data[field]).toBe(REDACTED);
    }
  });

  it('redacts every classified parameter in the query string', () => {
    for (const field of SENSITIVE_FIELD_NAMES) {
      const event: any = { request: { query_string: `${field}=${SECRET}&page=2` } };
      scrubSentryEvent(event);
      expect(event.request.query_string).not.toContain(SECRET);
      expect(event.request.query_string).toContain('page=2');
    }
  });

  it('masks every value sample everywhere an event can carry text', () => {
    for (const sample of Object.values(VALUE_SAMPLES)) {
      const event: any = {
        message: `login for ${sample}`,
        request: { data: { note: sample }, url: `https://x.test/a?note=${sample}` },
        extra: { deep: { deeper: [sample] } },
        breadcrumbs: [{ message: sample, data: { note: sample } }],
        exception: { values: [{ value: `failed for ${sample}` }] },
      };
      scrubSentryEvent(event);
      const serialized = JSON.stringify(event);
      expect(serialized).not.toContain(sample);
    }
  });

  it('never forwards the Authorization or Cookie header', () => {
    const event: any = {
      request: {
        headers: { Authorization: 'Bearer abc.def.ghi', 'Set-Cookie': 'sid=1', host: 'api.test' },
        cookies: { sid: 'abc' },
      },
    };
    scrubSentryEvent(event);
    expect(event.request.headers.Authorization).toBe(REDACTED);
    expect(event.request.headers['Set-Cookie']).toBe(REDACTED);
    expect(event.request.cookies).toBe(REDACTED);
    // Non-sensitive headers survive, or the events stop being useful.
    expect(event.request.headers.host).toBe('api.test');
  });

  it('keeps the user id but classifies the rest of the user object', () => {
    const event: any = { user: { id: 'usr_1', email: 'ivan@example.com', phone: '+7 916 123-45-67' } };
    scrubSentryEvent(event);
    expect(event.user.id).toBe('usr_1');
    expect(event.user.email).toBe(REDACTED);
    expect(event.user.phone).toBe(REDACTED);
  });

  it('does not collect personal data by default', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'sentry.ts'), 'utf8');
    expect(source).toContain('sendDefaultPii: false');
  });

  it('is driven by the same classification the internal masker uses', () => {
    const payload = { password: SECRET, note: VALUE_SAMPLES.email, nested: { inn: SECRET } };
    const internal = LogMaskingMiddleware.maskObject(structuredClone(payload));
    const event: any = { request: { data: structuredClone(payload) } };
    scrubSentryEvent(event);
    expect(event.request.data).toEqual(internal);
  });
});

describe('query string masking', () => {
  it('leaves ordinary parameters readable', () => {
    expect(maskQueryString('page=2&sort=name')).toBe('page=2&sort=name');
  });

  it('redacts a verification token travelling in the query string', () => {
    // V14.2.1 recorded that verification tokens travel here.
    expect(maskQueryString('token=abc123&page=2')).toBe(`token=${REDACTED}&page=2`);
  });
});
