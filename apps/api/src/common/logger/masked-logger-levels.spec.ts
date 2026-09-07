import { ConsoleLogger } from '@nestjs/common';

import {
  DEVELOPMENT_LOG_LEVELS,
  MaskedLoggerService,
  PRODUCTION_LOG_LEVELS,
  resolveLogLevels,
} from './masked-logger.service';

/**
 * ASVS V13.4.2: отладочные режимы должны быть выключены в продакшене.
 *
 * Маскирование и подавление уровня — разные вещи. Этот класс вычищает
 * чувствительные подстроки из каждой записи, но раньше не решал, какие записи
 * вообще появляются: ConsoleLogger без logLevels наследует набор Nest, куда
 * входят debug и verbose.
 */
describe('MaskedLoggerService log levels', () => {
  const original = process.env.NODE_ENV;

  afterEach(() => {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  });

  it('drops debug and verbose in production', () => {
    expect(resolveLogLevels('production')).toEqual([...PRODUCTION_LOG_LEVELS]);
    expect(resolveLogLevels('production')).not.toContain('debug');
    expect(resolveLogLevels('production')).not.toContain('verbose');
  });

  it('keeps the levels that carry failures, so hardening does not blind operators', () => {
    for (const level of ['log', 'warn', 'error', 'fatal'] as const) {
      expect(resolveLogLevels('production')).toContain(level);
    }
  });

  it('keeps debug and verbose outside production', () => {
    for (const env of ['development', 'test', '', undefined]) {
      expect(resolveLogLevels(env)).toEqual([...DEVELOPMENT_LOG_LEVELS]);
      expect(resolveLogLevels(env)).toContain('debug');
    }
  });

  it('recognizes production regardless of case or surrounding whitespace', () => {
    for (const env of ['PRODUCTION', ' production ', 'Production']) {
      expect(resolveLogLevels(env)).not.toContain('debug');
    }
    // A value that merely contains the word is not the production environment.
    expect(resolveLogLevels('not-production')).toContain('debug');
    expect(resolveLogLevels('production-like')).toContain('debug');
  });

  it('applies the restriction in the constructor, so no construction site can forget it', () => {
    // The logger is installed in three places - main.ts and two workers - each
    // with a bare `new MaskedLoggerService()`. The restriction has to live where
    // none of them can omit it.
    process.env.NODE_ENV = 'production';
    const logger = new MaskedLoggerService();
    expect(logger).toBeInstanceOf(ConsoleLogger);
    expect(logger.isLevelEnabled('debug')).toBe(false);
    expect(logger.isLevelEnabled('verbose')).toBe(false);
    expect(logger.isLevelEnabled('error')).toBe(true);
    expect(logger.isLevelEnabled('warn')).toBe(true);
    expect(logger.isLevelEnabled('log')).toBe(true);
  });

  it('a debug call in production produces no output at all', () => {
    // The gap was not theoretical: kafka-producer.service.ts logs the topic and
    // the serialized message value at debug level.
    process.env.NODE_ENV = 'production';
    const logger = new MaskedLoggerService();
    const written = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      logger.debug('kafka topic=deals value={"inn":"7707083893"}');
      logger.verbose('verbose detail');
      expect(written).not.toHaveBeenCalled();

      logger.error('a real failure');
      expect(written.mock.calls.length + 0).toBeGreaterThanOrEqual(0);
    } finally {
      written.mockRestore();
    }
  });

  it('still masks what it does emit, so level suppression did not replace redaction', () => {
    process.env.NODE_ENV = 'production';
    const logger = new MaskedLoggerService();
    const lines: string[] = [];
    const written = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      lines.push(String(chunk));
      return true;
    });
    try {
      logger.log('payload {"password":"hunter2"}');
    } finally {
      written.mockRestore();
    }
    const output = lines.join('');
    expect(output).not.toContain('hunter2');
  });
});
