import { IsISO8601, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { VersionedLabCommandDto } from './lab-command.dto';

export class RecordTestDto extends VersionedLabCommandDto {
  @IsString()
  @MaxLength(120)
  metric!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  value!: number;

  @IsString()
  @MaxLength(32)
  unit!: string;

  @IsString()
  @MaxLength(120)
  methodCode!: string;

  @IsString()
  @MaxLength(120)
  equipmentCode!: string;

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
