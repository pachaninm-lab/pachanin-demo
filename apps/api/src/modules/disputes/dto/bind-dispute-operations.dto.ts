import { IsOptional, IsString, Matches } from 'class-validator';
import { DisputeVersionCommandDto } from './dispute-version-command.dto';

const SAFE_ID = /^[A-Za-z0-9:_.-]{1,240}$/;

export class BindDisputeOperationsDto extends DisputeVersionCommandDto {
  @IsString()
  @Matches(SAFE_ID)
  instructionId!: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_ID)
  sellerOperationId?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_ID)
  buyerOperationId?: string;
}
