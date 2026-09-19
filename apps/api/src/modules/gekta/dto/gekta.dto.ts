import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  GEKTA_CONVERSATION_TITLE_MAX,
  GEKTA_IMPORT_MAX_CONVERSATIONS,
  GEKTA_IMPORT_MAX_MESSAGES,
  GEKTA_LOCALE_MAX,
  GEKTA_MESSAGE_ANNOTATION_MAX,
  GEKTA_MESSAGE_BODY_MAX,
  GEKTA_MESSAGE_ROLES,
  GEKTA_PHONE_MAX,
  GEKTA_PROJECT_DESCRIPTION_MAX,
  GEKTA_PROJECT_NAME_MAX,
} from '../gekta.contract';
import type { GektaMessageRole } from '../gekta.contract';

/**
 * Тела пользовательской части кабинета.
 *
 * Инлайн-тип `@Body() body: { … }` стирается до `Object`, и глобальный
 * ValidationPipe на нём не срабатывает — это измерено в
 * `common/validation/request-body-validation-mechanism.spec.ts`. Пока тела
 * объявлены здесь классами, пайп их видит.
 *
 * Ограничения длины повторяют объявления столбцов, а не заменяют собой
 * очистку в сервисе: `clean()` по-прежнему срезает управляющие символы и
 * схлопывает пробелы. DTO закрывает другое — значение, которого столбец
 * принять не может.
 */

/** Формат телефона остаётся за `GektaPhoneService.normalize`; здесь — только границы строки. */
export class DeclarePhoneDto {
  @IsString()
  @Length(1, GEKTA_PHONE_MAX)
  phone!: string;
}

/**
 * Столбец `locale` — VarChar(8). Значение длиннее до этого прохода доходило до
 * PostgreSQL и возвращалось ошибкой 22001, то есть пользовательский ввод
 * становился 500. `String({})` даёт `"[object Object]"` длиной 15 — этого было
 * достаточно.
 */
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Za-z]{2,3})?$/u;

export class CreateProjectDto {
  @IsString()
  @Length(1, GEKTA_PROJECT_NAME_MAX)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(GEKTA_PROJECT_DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(GEKTA_LOCALE_MAX)
  @Matches(LOCALE_PATTERN)
  locale?: string;
}

export class RenameProjectDto {
  @IsString()
  @Length(1, GEKTA_PROJECT_NAME_MAX)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(GEKTA_PROJECT_DESCRIPTION_MAX)
  description?: string;
}

/**
 * `projectId: null` — это «вынести диалог из проекта», а отсутствие поля —
 * «не трогать проект». `@IsOptional()` пропускает оба, и контроллер
 * по-прежнему различает их через `!== undefined`.
 */
export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(GEKTA_CONVERSATION_TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(GEKTA_LOCALE_MAX)
  @Matches(LOCALE_PATTERN)
  locale?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  projectId?: string | null;
}

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(GEKTA_CONVERSATION_TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  projectId?: string | null;
}

/**
 * Роль сообщения ограничена тем же списком, по которому её нормализует
 * контроллер. Содержимое `citations` и `attachments` не проверяется — это
 * Json-столбцы; ограничено только их количество, и выдавать это за проверку
 * содержимого нельзя.
 */
export class AppendMessageDto {
  @IsOptional()
  @IsIn(GEKTA_MESSAGE_ROLES)
  role?: GektaMessageRole;

  @IsString()
  @Length(1, GEKTA_MESSAGE_BODY_MAX)
  body!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(GEKTA_MESSAGE_ANNOTATION_MAX)
  citations?: unknown[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(GEKTA_MESSAGE_ANNOTATION_MAX)
  attachments?: unknown[];
}

/**
 * Импорт анонимной истории. До этого прохода тело уходило в сервис через
 * `as never`, поэтому диалог без поля `messages` давал
 * `TypeError: Cannot read properties of undefined (reading 'slice')`, а
 * диалог без `title` — то же самое на `replace`. Оба — 500 на пользовательском
 * вводе.
 */
export class ImportMessageDto {
  @IsIn(GEKTA_MESSAGE_ROLES)
  role!: GektaMessageRole;

  /**
   * Здесь `@MaxLength`, а не `@Length(1, …)`: пустое сообщение в старой
   * локальной истории отклонило бы всю часть переноса, и история осталась бы
   * неперенесённой. У живого маршрута дописывания требование строже.
   */
  @IsString()
  @MaxLength(GEKTA_MESSAGE_BODY_MAX)
  body!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  createdAt?: string;
}

export class ImportConversationDto {
  @IsString()
  @Length(1, GEKTA_CONVERSATION_TITLE_MAX)
  title!: string;

  @IsString()
  @MaxLength(GEKTA_LOCALE_MAX)
  @Matches(LOCALE_PATTERN)
  locale!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  createdAt?: string;

  @IsArray()
  @ArrayMaxSize(GEKTA_IMPORT_MAX_MESSAGES)
  @ValidateNested({ each: true })
  @Type(() => ImportMessageDto)
  messages!: ImportMessageDto[];
}

export class ImportHistoryDto {
  @IsArray()
  @ArrayMaxSize(GEKTA_IMPORT_MAX_CONVERSATIONS)
  @ValidateNested({ each: true })
  @Type(() => ImportConversationDto)
  conversations!: ImportConversationDto[];
}
