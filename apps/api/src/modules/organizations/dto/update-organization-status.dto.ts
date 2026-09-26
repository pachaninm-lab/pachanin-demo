import { IsIn } from 'class-validator';

/**
 * Статус организации.
 *
 * Колонка объявлена как `String @default("PENDING")`, а не перечислением, и
 * сервис писал в неё `status as any`. Измерено: `updateStatus('ЧТО-УГОДНО')`
 * записывает `{"status":"ЧТО-УГОДНО"}`, а `updateStatus('')` — пустую строку.
 * Ниже по течению статус сравнивают со строковыми константами, поэтому
 * значение, которого платформа не пишет, тихо уводит каждое такое сравнение
 * в else-ветку — тот же класс, что и 'approved' вместо 'APPROVED' в KYC.
 *
 * Список — это ровно те значения, которые платформа сама записывает, и он
 * получен перечислением ВСЕХ мест записи в organization.status:
 *   PENDING    — создание организации и default в схеме
 *   VERIFIED   — KYC одобрен (resolveKycTask)
 *   SUSPENDED  — KYC отклонён (resolveKycTask)
 *   BLOCKED    — блокировка комплаенсом (blockOrganization)
 *
 * Проверено, что сужение никого не ломает: у маршрута
 * PATCH /api/organizations/:id/status нет ни одного вызывающего ни в вебе, ни
 * в e2e.
 */
export const ORGANIZATION_STATUSES = ['PENDING', 'VERIFIED', 'SUSPENDED', 'BLOCKED'] as const;

export class UpdateOrganizationStatusDto {
  @IsIn(ORGANIZATION_STATUSES as unknown as string[])
  status!: string;
}
