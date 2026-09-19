import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * The single password policy for setting or changing a password: registration,
 * Gekta registration, invitation acceptance, recovery and admin reset all pass
 * through here.
 *
 * It is one function because it was three, and the three had already drifted.
 * This module enforced no upper bound while gekta-registration.service.ts and
 * password-reset.service.ts capped at 128, so a 240-character password was
 * accepted at registration and refused at reset; those two, in turn, never
 * applied the all-same and sequential checks written here. Same shape as the
 * bcrypt-cost incident documented in password-hashing.ts: a rule copied to
 * several places stops being one rule.
 *
 * The upper bound is not cosmetic. bcrypt truncates its input at 72 bytes
 * (ASVS V6.2.8), so an unbounded field lets someone believe a 240-character
 * password protects them when only its beginning is ever hashed. Capping does
 * not fix that truncation - it removes the case where the gap is widest.
 *
 * Rules:
 *  - 12 to 128 characters;
 *  - at least 3 of {lowercase, uppercase, digit, symbol};
 *  - not a single repeated character;
 *  - not a trivial sequential run.
 *
 * The character-class rule is deliberately kept: ASVS 5.0 V6.2.5 asks for it
 * to go, but only alongside a breached-password check, and that check is
 * blocked on an owner decision about third-party list licensing (see the
 * clean-room programme issue). Dropping it alone would weaken the policy.
 */
export function isStrongPassword(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) return false;

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
  if (classes < 3) return false;

  // Reject all-same character and obvious ascending/descending runs.
  if (/^(.)\1+$/.test(value)) return false;
  const lowered = value.toLowerCase();
  const sequences = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop'];
  for (const seq of sequences) {
    if (seq.includes(lowered) || [...seq].reverse().join('').includes(lowered)) return false;
  }

  return true;
}

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isStrongPassword(value);
  }

  defaultMessage(_args: ValidationArguments): string {
    return `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters and mix at least three of: lowercase, uppercase, digits, symbols. Avoid all-numeric or sequential passwords.`;
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
