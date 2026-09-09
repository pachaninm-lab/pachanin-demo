import {
  IsEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/;

/** Authority and lifecycle fields are derived by the server and PostgreSQL. */
export class OrganizationCapabilityForbiddenAuthorityDto {
  @IsOptional()
  @IsEmpty({ message: 'role is server-derived' })
  role?: never;

  @IsOptional()
  @IsEmpty({ message: 'tenantId is server-derived' })
  tenantId?: never;

  @IsOptional()
  @IsEmpty({ message: 'orgId is server-derived' })
  orgId?: never;

  @IsOptional()
  @IsEmpty({ message: 'membershipId is server-derived' })
  membershipId?: never;

  @IsOptional()
  @IsEmpty({ message: 'status is server-derived' })
  status?: never;

  @IsOptional()
  @IsEmpty({ message: 'requiresVerification is server-derived' })
  requiresVerification?: never;

  @IsOptional()
  @IsEmpty({ message: 'expectedVersion must be supplied only through If-Match' })
  expectedVersion?: never;
}

export class ExecuteOrganizationCapabilityCommandDto
extends OrganizationCapabilityForbiddenAuthorityDto {
  @IsString()
  @Matches(SAFE_ID)
  commandId!: string;

  @IsString()
  @Matches(SAFE_ID)
  idempotencyKey!: string;

  @IsString()
  @Matches(SAFE_ID)
  correlationId!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}
