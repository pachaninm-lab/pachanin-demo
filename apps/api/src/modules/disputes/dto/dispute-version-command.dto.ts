import { IsString, Matches, MaxLength } from 'class-validator';

const SAFE_COMMAND_KEY = /^[A-Za-z0-9:_.-]{1,240}$/;
const POSITIVE_VERSION = /^(?:[1-9]\d*)$/;

export class DisputeVersionCommandDto {
  @IsString()
  @Matches(POSITIVE_VERSION)
  expectedVersion!: string;

  @IsString()
  @MaxLength(240)
  @Matches(SAFE_COMMAND_KEY)
  idempotencyKey!: string;
}
