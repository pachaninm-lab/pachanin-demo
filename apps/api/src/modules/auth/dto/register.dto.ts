import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '../../../common/types/request-user';
import { IsStrongPassword } from '../../../common/validators/strong-password.validator';
const OrgType = ['LEGAL', 'INDIVIDUAL', 'SELF_EMPLOYED'] as const;
type OrgType = typeof OrgType[number];

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  orgId?: string;

  @IsOptional()
  @IsString()
  orgLegalName?: string;

  @IsOptional()
  @IsString()
  orgInn?: string;

  @IsOptional()
  @IsString()
  orgType?: OrgType;

  @IsEnum(Role)
  role!: Role;

  @IsString()
  @IsStrongPassword()
  password!: string;

  @IsOptional()
  @IsString()
  consentVersion?: string;
}
