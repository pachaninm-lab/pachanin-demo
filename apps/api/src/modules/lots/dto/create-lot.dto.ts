import { IsString, IsNumber, IsOptional, IsIn, Min, IsDateString } from 'class-validator';

const VALID_CULTURES = [
  'wheat', 'barley', 'corn', 'rye', 'oats', 'millet', 'buckwheat', 'triticale',
  'sunflower', 'rapeseed', 'flax', 'mustard',
  'peas', 'chickpeas', 'lentils', 'soybean',
  'sugarbeet',
];

export class CreateLotDto {
  @IsString()
  title: string;

  @IsString()
  @IsIn(VALID_CULTURES, { message: 'Культура должна быть из списка: ' + VALID_CULTURES.join(', ') })
  culture: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsNumber()
  @Min(0.1, { message: 'Объём должен быть больше 0' })
  volumeTons: number;

  @IsNumber()
  @Min(1, { message: 'Стартовая цена должна быть больше 0' })
  startPrice: number;

  @IsNumber()
  @Min(1)
  stepPrice: number;

  @IsString()
  region: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  qualityJson?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsDateString()
  auctionEndsAt: string;
}
