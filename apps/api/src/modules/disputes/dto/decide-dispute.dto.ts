import { IsOptional, IsString } from 'class-validator';

export class DecideDisputeDto {
  @IsString()
  outcome!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
