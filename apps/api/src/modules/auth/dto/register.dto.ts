import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../../common/types/request-user';
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
  @IsOptional()
  @IsString()
  orgType?: OrgType;

  @IsEnum(Role)
  role!: Role;

  @IsString()
  @MinLength(8)
  password!: string;
}
