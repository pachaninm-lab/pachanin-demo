import { IsISO8601, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class ExecuteDealCommandDto {
  @IsString()
  @Length(8, 128)
  commandId!: string;

  @IsString()
  @Length(8, 200)
  idempotencyKey!: string;

  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
