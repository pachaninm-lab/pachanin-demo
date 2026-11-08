import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { TICKET_PRIORITIES } from '../support.priorities';

/**
 * Тела запросов поддержки (ASVS 5.0 V2.2.1 / V2.2.2).
 *
 * Пять обработчиков объявляли тело инлайн-типом, который стирается до `Object`,
 * поэтому глобальный `ValidationPipe` на них не действовал.
 *
 * Что здесь НЕ дефект и потому не трогается: разрешения в этом модуле как раз
 * на месте. `assignTicket`, `resolveTicket` и `escalateTicket` закрыты
 * `assertSupport`; `addComment` требует роли поддержки или авторства тикета;
 * флаг `isInternal` в сервисе домножается на проверку роли
 * (`isInternal && SUPPORT_ROLES.includes(user.role)`), поэтому обычный
 * пользователь внутренний комментарий не создаст. Это работающие контроли, и
 * DTO их не заменяет и не дублирует.
 *
 * Что было дефектом — union-тип `TicketPriority` не существовал во время
 * выполнения. Замерено:
 *
 *   priority: 'СРОЧНО!!!'  → сохранено как есть
 *   очередь                → ['CRITICAL', 'СРОЧНО!!!']
 *
 * `listQueue` сортирует по `priorityOrder[p] ?? 3`, поэтому неизвестный
 * приоритет получает НИЗШИЙ ранг. То есть тикет, который отправитель пометил
 * срочным своими словами, не отклонялся, а тихо опускался в конец очереди
 * поддержки. Отказ на границе честнее молчаливого понижения.
 *
 * Длины полей ограничены по той же причине, что и в партнёрском API: тема в
 * 50 000 символов принималась и сохранялась.
 */

export class CreateTicketDto {
  @IsString()
  @Length(1, 300)
  subject!: string;

  @IsString()
  @Length(1, 10_000)
  description!: string;

  @IsString()
  @Length(1, 100)
  category!: string;

  /**
   * Список берётся из `support.priorities.ts`, а не переписывается здесь:
   * тип в сервисе и проверка на границе обязаны говорить об одном и том же.
   */
  @IsOptional()
  @IsIn(TICKET_PRIORITIES as unknown as string[])
  priority?: (typeof TICKET_PRIORITIES)[number];

  @IsOptional()
  @IsString()
  @Length(1, 200)
  dealId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  organizationId?: string;
}

export class AssignTicketDto {
  @IsString()
  @Length(1, 200)
  assigneeId!: string;
}

export class ResolveTicketDto {
  @IsString()
  @Length(1, 5_000)
  resolution!: string;
}

export class EscalateTicketDto {
  @IsString()
  @Length(1, 2_000)
  reason!: string;
}

export class AddCommentDto {
  @IsString()
  @Length(1, 10_000)
  text!: string;

  /**
   * Именно `@IsBoolean()`, без приведения. Строка `"true"` не должна
   * превращаться в флаг: решение о внутреннем комментарии принимает сервис по
   * роли, и границе незачем подсовывать ему значение другого типа.
   */
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
