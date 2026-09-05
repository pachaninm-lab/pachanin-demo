import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import {
  DISPUTE_NOTE_MAX,
  DISPUTE_OUTCOMES,
  DISPUTE_REASON_MAX,
  SPLIT_PCT_MAX,
  SPLIT_PCT_MIN,
} from '../arbitrator.contract';

/**
 * Тело разрешения спора.
 *
 * Инлайн-тип `@Body() body: { … }` стирается до `Object`, и глобальный
 * ValidationPipe на него не действует — поэтому `splitPct` не проверялся.
 *
 * `@Type(() => Number)` здесь сознательно НЕ применяется: приведение
 * выполнялось бы до проверки диапазона.
 */
export class ResolveDisputeDto {
  @IsIn(DISPUTE_OUTCOMES as unknown as readonly string[])
  outcome!: string;

  /**
   * Доля покупателя в процентах. Необязательна для трёх остальных исходов и
   * обязательна для SPLIT — это требование проверяет сервис, потому что оно
   * связывает два поля, а не ограничивает одно.
   */
  @IsOptional()
  @IsInt()
  @Min(SPLIT_PCT_MIN)
  @Max(SPLIT_PCT_MAX)
  splitPct?: number;

  @IsString()
  @Length(1, DISPUTE_REASON_MAX)
  reason!: string;
}

export class AddDisputeNoteDto {
  @IsString()
  @Length(1, DISPUTE_NOTE_MAX)
  note!: string;
}
