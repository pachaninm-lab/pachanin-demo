import { IsOptional, IsString, MinLength } from 'class-validator';

export class RevokeUserSessionsDto {
  @IsString()
  @MinLength(3)
  userId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
