import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { RegistrationDecision } from '../registration-decision.service';

export class VerifyRegistrationEmailDto {
  @IsString()
  @MinLength(48)
  @MaxLength(512)
  token!: string;
}

export class RegistrationDecisionDto {
  @IsIn(['APPROVE', 'REJECT', 'REQUEST_INFORMATION', 'SUSPEND'])
  decision!: RegistrationDecision;

  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  reason!: string;
}
