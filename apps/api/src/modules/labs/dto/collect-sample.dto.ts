import { IsISO8601, IsString, MaxLength } from 'class-validator';
import { VersionedLabCommandDto } from './lab-command.dto';

export class CollectSampleDto extends VersionedLabCommandDto {
  @IsString()
  @MaxLength(200)
  evidenceRef!: string;

  @IsISO8601({ strict: true })
  occurredAt!: string;
}
