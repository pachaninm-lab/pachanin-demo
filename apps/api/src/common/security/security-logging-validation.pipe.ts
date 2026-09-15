import { Logger, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { SECURITY_EVENTS, recordSecurityEvent, safeFieldNames } from './security-events';

/**
 * ASVS 5.0 V16.3.3: an attempt to push a value past a declared constraint is an
 * attempt to bypass input validation, and must leave a record.
 *
 * It did not. The global pipe was constructed with no exceptionFactory, so a
 * rejected payload produced a 400 and nothing else - the request line was the
 * only evidence that anything had been refused.
 *
 * This wraps the factory rather than replacing it, and the distinction is the
 * whole reason the class exists. Nest's own factory calls
 * flattenValidationErrors, which reduces each error to its message STRINGS.
 * Passing the raw ValidationError array to BadRequestException instead - the
 * obvious way to write this - changes the 400 body from a list of messages into
 * the error objects, and each of those carries `value` and `target`: the
 * rejected value and the whole object the caller submitted, reflected back in
 * the response. Adding logging is not a reason to start echoing payloads, so the
 * base factory is called and its result returned unchanged.
 */
export class SecurityLoggingValidationPipe extends ValidationPipe {
  private readonly securityLogger = new Logger('InputValidation');

  createExceptionFactory(): (validationErrors?: ValidationError[]) => unknown {
    const base = super.createExceptionFactory();
    // Returns a closure: `securityLogger` is a subclass field and is still
    // undefined while the base constructor runs, but is set by the time a
    // request reaches this.
    return (validationErrors: ValidationError[] = []) => {
      recordSecurityEvent(this.securityLogger, SECURITY_EVENTS.INPUT_VALIDATION_REJECTED, {
        control: 'SecurityLoggingValidationPipe',
        reason: 'CONSTRAINT_VIOLATION',
        // Property names only. The messages quote the caller's values, and for a
        // body typed as a plain object the property name is itself the caller's,
        // so the names are filtered before they are written.
        fields: safeFieldNames(validationErrors.map((error) => error?.property)),
        count: validationErrors.length,
      });
      return base(validationErrors);
    };
  }
}
