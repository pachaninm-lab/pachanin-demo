import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DisputeVersionCommandDto } from './dispute-version-command.dto';

export class DecideDisputeDto extends DisputeVersionCommandDto {
  @IsString()
  @IsIn(['BUYER_WIN', 'SELLER_WIN', 'SPLIT', 'NO_CLAIM'])
  outcome!: string;

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
