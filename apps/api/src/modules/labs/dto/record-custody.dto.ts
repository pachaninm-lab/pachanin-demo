import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { VersionedLabCommandDto } from './lab-command.dto';
import type { LabCustodyEventType } from '../lab.repository';

export class RecordCustodyDto extends VersionedLabCommandDto {
  @IsIn(['SEALED', 'HANDOFF', 'RECEIVED', 'OPENED'])
  eventType!: LabCustodyEventType;

  @IsString()
  @MaxLength(200)
  evidenceRef!: string;

  @IsISO8601({ strict: true })
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
