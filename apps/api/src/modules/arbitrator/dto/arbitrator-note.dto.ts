import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Заметка арбитра по спору.
 *
 * Значение уходило прямо в `arbitratorNotes` без проверки типа и длины.
 * Инлайн-тип `{ note: string }` объявлял строку, но стирается до `Object`,
 * поэтому объявление ничего не гарантировало.
 */
export class ArbitratorNoteDto {
  @IsString({ message: 'Заметка арбитра должна быть строкой.' })
  @MinLength(1, { message: 'Заметка арбитра не может быть пустой.' })
  @MaxLength(5000)
  note!: string;
}
