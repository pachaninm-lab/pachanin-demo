import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { StaffAccessMode, StaffPermission, StaffRole } from './staff-access.types';

export class CreateStaffAssignmentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  userId!: string;

  @IsEnum(StaffRole)
  role!: StaffRole;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}

export class RevokeStaffAssignmentDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}

export class RequestStaffAccessDto {
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  assignmentId!: string;

  @IsEnum(StaffAccessMode)
  accessMode!: StaffAccessMode;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(StaffPermission, { each: true })
  permissions!: StaffPermission[];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  targetTenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  targetOrganizationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  targetUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  targetDealId?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(128)
  ticketId!: string;

  @IsInt()
  @Min(60)
  @Max(3600)
  durationSeconds!: number;
}

export class DecideStaffAccessDto {
  @IsIn(['APPROVE', 'DENY'])
  decision!: 'APPROVE' | 'DENY';

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}

export class EndStaffSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason?: string;
}

export class ActivateBreakGlassDto {
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  assignmentId!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  reason!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(128)
  ticketId!: string;
}

export class RequestCriticalActionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  action!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(128)
  resourceType!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(256)
  resourceId!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class DecideCriticalActionDto {
  @IsIn(['APPROVE', 'DENY'])
  decision!: 'APPROVE' | 'DENY';

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}

export class ConsumeCriticalActionDto {
  @IsObject()
  payload!: Record<string, unknown>;
}
