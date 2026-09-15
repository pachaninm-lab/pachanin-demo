import { MaskedLoggerService } from './masked-logger.service';

/**
 * ASVS 5.0 V13.4.2: no verbose or debug logging in production.
 *
 * Masking and level suppression are different things, and only the first was
 * true here. MaskedLoggerService redacts sensitive substrings from every call,
 * but it extends ConsoleLogger without a logLevels option, so it inherited
 * Nest's default levels - which include debug and verbose - and nothing
 * anywhere set logLevels or LOG_LEVEL to narrow them for any environment.
 *
 * These assert the level policy by asking the logger what it will emit, in the
 * environment it is told it is in, rather than by reading the class.
 */

function inEnvironment<T>(nodeEnv: string | undefined, work: () => T): T {
  const previous = process.env.NODE_ENV;
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  try {
    return work();
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

describe('what the application logger will emit', () => {
  it('says nothing at debug or verbose in production', () => {
    inEnvironment('production', () => {
      const logger = new MaskedLoggerService();
      expect(logger.isLevelEnabled('debug')).toBe(false);
      expect(logger.isLevelEnabled('verbose')).toBe(false);
    });
  });

  it('keeps the levels an operator needs in production', () => {
    // Suppressing debug must not suppress the record of things going wrong.
    inEnvironment('production', () => {
      const logger = new MaskedLoggerService();
      for (const level of ['log', 'warn', 'error', 'fatal'] as const) {
        expect([level, logger.isLevelEnabled(level)]).toEqual([level, true]);
      }
    });
  });

  it('leaves debug available away from production, where it is useful', () => {
    inEnvironment('development', () => {
      const logger = new MaskedLoggerService();
      expect(logger.isLevelEnabled('debug')).toBe(true);
    });
  });

  it('treats an unset environment as not production, but still not verbose', () => {
    // An unset NODE_ENV is a development shell far more often than a
    // production deployment, and a deployment that forgets to set it is
    // caught by the startup assertion rather than by the logger.
    inEnvironment(undefined, () => {
      const logger = new MaskedLoggerService();
      expect(logger.isLevelEnabled('debug')).toBe(true);
    });
  });

  it('still masks what it does emit', () => {
    // The level policy must not be read as replacing the redaction; both hold.
    const written: string[] = [];
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });
    try {
      inEnvironment('production', () => {
        new MaskedLoggerService().log('{"password":"hunter2"}');
      });
    } finally {
      spy.mockRestore();
    }
    expect(written.join('')).not.toContain('hunter2');
  });
});
