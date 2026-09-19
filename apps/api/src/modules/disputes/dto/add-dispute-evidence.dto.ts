import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { DisputeVersionCommandDto } from './dispute-version-command.dto';

const SAFE_ID = /^[A-Za-z0-9:_.-]{1,240}$/;

export class AddDisputeEvidenceDto extends DisputeVersionCommandDto {
  @IsString()
  @IsIn(['PHOTO', 'DOCUMENT', 'GPS', 'WEIGHT', 'LAB', 'STATEMENT', 'OTHER'])
  type!: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_ID)
  fileId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  description!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  source!: string;
}
