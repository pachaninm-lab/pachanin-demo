import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateDocumentPackageDto {
  @IsString()
  @MaxLength(200)
  commandId!: string;

  @IsString()
  @MaxLength(200)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlationId?: string;
}
