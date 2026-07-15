import { IsString, MaxLength, MinLength } from 'class-validator';
import { DisputeVersionCommandDto } from './dispute-version-command.dto';

export class AppealDisputeDto extends DisputeVersionCommandDto {
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  reason!: string;
}
