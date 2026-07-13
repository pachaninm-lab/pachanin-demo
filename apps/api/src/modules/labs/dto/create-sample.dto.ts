import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { LabCommandDto } from './lab-command.dto';

export class CreateSampleDto extends LabCommandDto {
  @IsString()
  @MaxLength(200)
  dealId!: string;

  @IsString()
  @MaxLength(200)
  shipmentId!: string;

  @IsString()
  @MaxLength(200)
  acceptanceId!: string;

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
