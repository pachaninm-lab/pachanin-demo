import { IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/strong-password.validator';

/**
 * Self-service password change (OWASP ASVS 5.0 V6.2.3).
 *
 * The current password carries no strength rule. It is checked against what is
 * stored, not against the policy: an account whose password predates the current
 * rule must still be able to leave that password behind, and applying the policy
 * to the value being replaced would lock exactly those accounts out of changing
 * it. It is still bounded, so an enormous string is refused before it reaches a
 * hash comparison.
 */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  currentPassword!: string;

  @IsString()
  @IsStrongPassword()
  newPassword!: string;
}
