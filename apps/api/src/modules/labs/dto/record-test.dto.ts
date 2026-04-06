import { IsNumber, IsOptional, IsString } from 'class-validator';

export class RecordTestDto {
  @IsString()
  metric!: string;

  @IsNumber()
  value!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
