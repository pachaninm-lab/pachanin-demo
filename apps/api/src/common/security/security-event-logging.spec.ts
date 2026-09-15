import { BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { IsInt, IsString, Max } from 'class-validator';
import { SecurityLoggingValidationPipe } from './security-logging-validation.pipe';
import { RolesGuard } from '../guards/roles.guard';
import { SECURITY_EVENTS, formatSecurityEvent, requestShape, safeFieldNames } from './security-events';

/**
 * ASVS 5.0 V16.3.3.
 *
 * These drive the real controls and read what they emit, rather than asserting
 * that a logging call appears in the source. A record nobody can see written is
 * the same as no record.
 */

class Payload {
  @IsString()
  name!: string;

  @IsInt()
  @Max(10)
  size!: number;
}

function captureWarnings(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const original = Logger.prototype.warn;
  Logger.prototype.warn = function warn(message: unknown) {
    lines.push(String(message));
  } as typeof Logger.prototype.warn;
  return { lines, restore: () => { Logger.prototype.warn = original; } };
}

const metadata = { type: 'body' as const, metatype: Payload, data: undefined };

describe('input validation records the attempt to get past it', () => {
  it('writes one parseable event naming the constraints that failed', async () => {
    const capture = captureWarnings();
    const pipe = new SecurityLoggingValidationPipe({ whitelist: true, transform: true });
    try {
      await expect(pipe.transform({ name: 42, size: 9999 }, metadata)).rejects.toBeInstanceOf(BadRequestException);
    } finally {
      capture.restore();
    }
    expect(capture.lines).toHaveLength(1);
    const event = JSON.parse(capture.lines[0]);
    expect(event.event).toBe(SECURITY_EVENTS.INPUT_VALIDATION_REJECTED);
    expect(event.control).toBe('SecurityLoggingValidationPipe');
    expect(event.fields.sort()).toEqual(['name', 'size']);
    expect(event.count).toBe(2);
  });

  it('says nothing when the payload is acceptable', async () => {
    const capture = captureWarnings();
    const pipe = new SecurityLoggingValidationPipe({ whitelist: true, transform: true });
    try {
      await expect(pipe.transform({ name: 'ok', size: 3 }, metadata)).resolves.toBeInstanceOf(Payload);
    } finally {
      capture.restore();
    }
    expect(capture.lines).toEqual([]);
  });

  it('returns exactly the response the stock pipe returns', async () => {
    // The regression this guards against is real and was nearly shipped:
    // building the exception from the raw ValidationError array instead of
    // letting Nest flatten it changes the 400 body from a list of messages into
    // error objects carrying `value` and `target` - the rejected value and the
    // whole object the caller submitted, reflected back to them.
    const body = { name: 42, size: 9999 };
    const capture = captureWarnings();
    let ours: unknown;
    let stock: unknown;
    try {
      ours = await new SecurityLoggingValidationPipe({ whitelist: true, transform: true })
        .transform(body, metadata).catch((error: unknown) => error);
      stock = await new ValidationPipe({ whitelist: true, transform: true })
        .transform(body, metadata).catch((error: unknown) => error);
    } finally {
      capture.restore();
    }
    expect((ours as BadRequestException).getResponse()).toEqual((stock as BadRequestException).getResponse());
    expect(JSON.stringify((ours as BadRequestException).getResponse())).not.toContain('9999');
  });
});

describe('an authenticated caller reaching past their role', () => {
  const guard = () => new RolesGuard({
    getAllAndOverride: () => ['ADMIN'],
  } as never);

  const context = (user: unknown) => ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user, method: 'POST', route: { path: '/deals/:id' } }) }),
  }) as never;

  it('is recorded, with the role read from the session', () => {
    const capture = captureWarnings();
    try {
      expect(() => guard().canActivate(context({ id: 'u-1', role: 'SELLER' })))
        .toThrow(ForbiddenException);
    } finally {
      capture.restore();
    }
    const event = JSON.parse(capture.lines[0]);
    expect(event.event).toBe(SECURITY_EVENTS.AUTHORIZATION_REJECTED);
    expect(event.subject).toBe('u-1');
    expect(event.route).toBe('/deals/:id');
    expect(event.fields).toEqual(['SELLER']);
  });

  it('is not recorded when the role is permitted', () => {
    const capture = captureWarnings();
    try {
      expect(guard().canActivate(context({ id: 'u-1', role: 'ADMIN' }))).toBe(true);
    } finally {
      capture.restore();
    }
    expect(capture.lines).toEqual([]);
  });
});

describe('what a recorded event is allowed to contain', () => {
  it('keeps the caller out of the record', () => {
    // A rejected body's property name is the CALLER's when the endpoint types
    // its body as a plain object. A name carrying a newline would forge a second
    // log line - the log-injection version of the bypass being recorded.
    const names = safeFieldNames([
      'legitimateField',
      'evil\n{"event":"security.authorization.rejected"}',
      'has space',
      'x'.repeat(200),
      42,
      null,
      'legitimateField',
    ]);
    expect(names).toEqual(['legitimateField']);
  });

  it('bounds how many names one event can carry', () => {
    expect(safeFieldNames(Array.from({ length: 100 }, (_, i) => `f${i}`))).toHaveLength(20);
  });

  it('records an unauthenticated caller as anonymous rather than omitting them', () => {
    const line = formatSecurityEvent(SECURITY_EVENTS.ANTI_AUTOMATION_REJECTED, {
      control: 'RateLimitGuard',
      reason: 'RATE_LIMITED',
    });
    expect(JSON.parse(line).subject).toBe('anonymous');
  });

  it('reads the route template from the route table, never the requested URL', () => {
    // req.url carries whatever the caller asked for; req.route.path is the
    // pattern this application registered.
    expect(requestShape({ method: 'GET', url: '/evil?x=1', route: { path: '/deals/:id' } }))
      .toEqual({ method: 'GET', route: '/deals/:id', subject: undefined });
    expect(requestShape({})).toEqual({ method: undefined, route: undefined, subject: undefined });
  });
});
