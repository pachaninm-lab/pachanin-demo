import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DisputeVersionCommandDto } from './dispute-version-command.dto';

export class ResolveDisputeAppealDto extends DisputeVersionCommandDto {
  @IsString()
  @IsIn(['UPHELD', 'OVERTURNED', 'MODIFIED', 'REJECTED'])
  resolution!: string;

  @IsString()
  @IsIn(['BUYER_WIN', 'SELLER_WIN', 'SPLIT', 'NO_CLAIM'])
  finalOutcome!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  sellerSplitPct?: number;

  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  note!: string;
}
