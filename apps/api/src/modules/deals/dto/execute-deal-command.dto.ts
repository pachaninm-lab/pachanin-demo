import { IsISO8601, IsObject, IsOptional, IsString, Length } from 'class-validator';
import type { Prisma } from '@prisma/client';

export class ExecuteDealCommandDto {
  @IsString()
  @Length(8, 128)
  commandId!: string;

  @IsString()
  @Length(8, 200)
  idempotencyKey!: string;

  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;

  /** Optimistic-concurrency token: the deal `version` the client last saw. */
  @IsOptional()
  @IsString()
  expectedVersion?: string;

  @IsOptional()
  @IsObject()
  payload?: Prisma.InputJsonObject;
}
