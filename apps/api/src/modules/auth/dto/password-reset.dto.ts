import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsIn(['ru', 'en', 'zh'])
  locale?: 'ru' | 'en' | 'zh';
}

export class ConfirmPasswordResetDto {
  @IsString()
  @MinLength(48)
  @MaxLength(512)
  token!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}
