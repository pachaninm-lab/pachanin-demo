import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  GEKTA_MANUAL_GRANT_KINDS,
  GEKTA_REASON_MAX,
  GEKTA_TRIAL_EXTENSION_MAX_DAYS,
  GEKTA_TRIAL_EXTENSION_MIN_DAYS,
} from '../gekta.contract';

/**
 * Тела кабинета оператора.
 *
 * Права на каждое действие проверяет `GektaOperatorGuard`; DTO их не заменяет
 * и не дублирует. Здесь закрывается другое: журнал.
 *
 * Консоль владельца уже не даёт отправить действие без причины
 * (`requireReason` в `GektaOwnerConsole.tsx`), но сервер до этого прохода
 * принимал `String(body?.reason ?? '')` — то есть пустую строку, а объект
 * записывал в журнал как `"[object Object]"`. Проверку на стороне браузера
 * нельзя выдавать за исполнение: запись «бессрочный доступ выдан, причина
 * пустая» ничего не объясняет.
 */

/** Причина обязательна и не может быть одними пробелами: журнал без причины бесполезен. */
const NOT_BLANK = /\S/u;

class OperatorActionDto {
  @IsString()
  @Length(1, GEKTA_REASON_MAX)
  @Matches(NOT_BLANK)
  reason!: string;
}

/**
 * `until` обязателен ровно для `UNTIL_DATE`. Раньше его отсутствие доходило до
 * сервиса и падало обычным `Error` (500), а неразбираемая дата проходила и
 * сторожевую проверку сервиса, и она же: `new Date('мусор')` — объект, то есть
 * значение истинное, а `!expiresAt` ложно.
 */
export class GrantAccessDto extends OperatorActionDto {
  @IsIn(GEKTA_MANUAL_GRANT_KINDS)
  kind!: string;

  @ValidateIf((dto: GrantAccessDto) => dto.kind === 'UNTIL_DATE')
  @IsDateString({ strict: true })
  until?: string;
}

export class GrantLifetimeDto extends OperatorActionDto {}

export class RevokeGrantDto extends OperatorActionDto {}

/**
 * `days` без `@Type(() => Number)` намеренно: приведение выполнялось бы до
 * `@IsInt`, и строка `"30"` молча стала бы числом. Консоль отправляет число.
 */
export class ExtendTrialDto extends OperatorActionDto {
  @IsOptional()
  @IsInt()
  @Min(GEKTA_TRIAL_EXTENSION_MIN_DAYS)
  @Max(GEKTA_TRIAL_EXTENSION_MAX_DAYS)
  days?: number;
}

/**
 * `suspended` обязателен. Прежнее `body?.suspended !== false` означало, что
 * приостанавливает всё, кроме литерального `false`: измерено — строка
 * `"false"` и число `0` приостанавливали аккаунт. Оператор, снимавший
 * приостановку, ставил её заново.
 */
export class SuspendAccountDto extends OperatorActionDto {
  @IsBoolean()
  suspended!: boolean;
}

export class ResetQuotaDto extends OperatorActionDto {}
