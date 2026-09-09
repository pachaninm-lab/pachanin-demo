import { IsIn, IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';

export class FounderControlUpsertDto {
  @IsObject()
  payload!: Record<string, unknown>;

  @IsString()
  @Length(1, 500)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  @Matches(/^\d+$/)
  expectedVersion?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'ARCHIVED';

  @IsOptional()
  @IsString()
  @Length(1, 80)
  source?: string;
}
