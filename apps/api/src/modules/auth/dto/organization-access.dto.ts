import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  ORGANIZATION_HUMAN_ROLES,
  type OrganizationHumanRole,
} from '../organization-role-policy';

export { ORGANIZATION_HUMAN_ROLES, type OrganizationHumanRole } from '../organization-role-policy';

export class CreateOrganizationInvitationDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsIn([...ORGANIZATION_HUMAN_ROLES])
  role!: OrganizationHumanRole;
}

export class AcceptOrganizationInvitationDto {
  @IsString()
  @MinLength(48)
  @MaxLength(512)
  token!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9()\-\s]{7,24}$/)
  phone?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  termsVersion!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  privacyVersion!: string;

  @IsBoolean()
  @Equals(true)
  acceptTerms!: true;

  @IsBoolean()
  @Equals(true)
  acceptPrivacy!: true;
}

export class OrganizationInvitationCommandDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class OrganizationMembershipRoleDto extends OrganizationInvitationCommandDto {
  @IsIn([...ORGANIZATION_HUMAN_ROLES])
  role!: OrganizationHumanRole;

  @IsString()
  @Matches(/^\d+$/)
  version!: string;
}

export class OrganizationMembershipRevokeDto extends OrganizationInvitationCommandDto {
  @IsString()
  @Matches(/^\d+$/)
  version!: string;
}

export class ConfirmMfaRecoveryDto {
  @IsString()
  @MinLength(48)
  @MaxLength(512)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}

export class OrganizationJoinDecisionDto extends OrganizationInvitationCommandDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';
}
