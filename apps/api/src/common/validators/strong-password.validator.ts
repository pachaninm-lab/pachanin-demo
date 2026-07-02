import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Password strength policy for setting/changing a password (registration,
 * recovery, admin reset). Rejects the weak passwords the external audit flagged
 * — notably short and all-numeric passwords such as an 8-digit PIN.
 *
 * Rules:
 *  - at least 12 characters;
 *  - not composed of a single character class (e.g. all digits, all letters) —
 *    requires at least 3 of {lowercase, uppercase, digit, symbol};
 *  - not a trivial sequential/repeated pattern.
 */
export function isStrongPassword(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.length < MIN_PASSWORD_LENGTH) return false;

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
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters and mix at least three of: lowercase, uppercase, digits, symbols. Avoid all-numeric or sequential passwords.`;
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
