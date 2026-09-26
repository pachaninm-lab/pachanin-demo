import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Причина оспаривания акта взвешивания.
 *
 * Инлайн-тип объявлял поле обязательным, но стирался до Object, поэтому
 * обязательным оно не было: пустое тело давало оспаривание без причины.
 */
export class DisputeActDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
