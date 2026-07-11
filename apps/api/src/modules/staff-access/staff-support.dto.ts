import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateStaffSupportCaseDto {
  @IsString() @MinLength(2) @MaxLength(128)
  organizationId!: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(128)
  userId?: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(128)
  dealId?: string;

  @IsString() @MinLength(3) @MaxLength(300)
  subject!: string;

  @IsString() @MinLength(10) @MaxLength(10000)
  description!: string;

  @IsIn(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'])
  priority!: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

  @IsString() @MinLength(8) @MaxLength(128)
  idempotencyKey!: string;
}

export class TransitionStaffSupportCaseDto {
  @IsIn(['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED'])
  status!: 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';

  @IsInt() @Min(1) @Max(2147483647)
  expectedVersion!: number;

  @IsString() @MinLength(5) @MaxLength(2000)
  note!: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(128)
  assignedStaffUserId?: string;
}

export class RevokeUserSessionsDto {
  @IsString() @MinLength(2) @MaxLength(128)
  organizationId!: string;

  @IsString() @MinLength(10) @MaxLength(2000)
  reason!: string;
}

export class InitiateUserRecoveryDto {
  @IsString() @MinLength(2) @MaxLength(128)
  organizationId!: string;

  @IsString() @MinLength(10) @MaxLength(2000)
  reason!: string;

  @IsString() @MinLength(3) @MaxLength(128)
  ticketId!: string;
}

export class ExecuteApprovedStaffActionDto {
  @IsString() @MinLength(3) @MaxLength(128)
  criticalRequestId!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
