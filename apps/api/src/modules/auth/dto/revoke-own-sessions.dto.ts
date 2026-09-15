import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * V7.5.2. Ending a session requires re-authenticating with at least one
 * factor, and the factor is the password: mfa_level may be NONE for a member
 * who has not enrolled, and gating on MFA would leave exactly those accounts
 * unable to end a session they have lost control of.
 *
 * Either name one session or ask for the others. The caller's own session is
 * never included in `others` - a request that ended the session making it would
 * log the user out of the device they are sitting at, which is what /logout is
 * for.
 */
export class RevokeOwnSessionsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string;

  @IsOptional()
  @IsBoolean()
  others?: boolean;
}
