import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Параметры генерации регуляторного отчёта.
 *
 * Замерено на настоящем сервисе, до правки, четыре отдельных дефекта:
 *
 *   from: 'мусор'                → RangeError: Invalid time value   (500 на вводе)
 *                                  и Invalid Date уходил в предикат Prisma
 *   from: 2026-12-31, to: 01-01  → принято молча, rowCount 0
 *   reportType: {}               → TypeError: toLowerCase is not a function (500)
 *   reportType: '../../etc/passwd' → reportId 'rpt-../../etc/passwd-…', и то же
 *                                  значение в objectId записи аудита
 *
 * Второй случай — самый тяжёлый и самый тихий: отчёт РЕГУЛЯТОРУ за период,
 * сообщающий «операций нет», хотя они есть. Комментарий в самом сервисе уже
 * называет этот класс для отказа БД; путь перевёрнутого диапазона оставался
 * открыт.
 *
 * Список типов взят не с потолка: это ровно те четыре, которые публикует
 * соседний listRegulatoryReports. Вызывающих на вебе у этого маршрута нет —
 * проверено, — поэтому сужение не отказывает никому, кто работал.
 */
export const REGULATORY_REPORT_TYPES = [
  'MINSELHHOZ_MONTHLY',
  'ROSSTAT_QUARTERLY',
  'FNS_QUARTERLY',
  'ROSFINMONITORING_THRESHOLD',
] as const;

export class GenerateRegulatoryReportDto {
  @IsIn(REGULATORY_REPORT_TYPES as unknown as string[])
  reportType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  period?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
