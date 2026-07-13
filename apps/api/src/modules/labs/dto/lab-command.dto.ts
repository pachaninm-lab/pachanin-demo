import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const IDENTIFIER = /^[A-Za-z0-9:_.-]+$/;

export class LabCommandDto {
  @IsString()
  @MaxLength(200)
  @Matches(IDENTIFIER)
  commandId!: string;

  @IsString()
  @MaxLength(200)
  @Matches(IDENTIFIER)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(IDENTIFIER)
  correlationId?: string;
}

export class VersionedLabCommandDto extends LabCommandDto {
  @IsString()
  @Matches(/^\d+$/)
  expectedVersion!: string;
}
