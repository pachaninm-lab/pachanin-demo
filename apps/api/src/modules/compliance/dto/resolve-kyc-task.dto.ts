import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Решение по задаче KYC.
 *
 * Инлайн-тип объявлял союз `'APPROVED' | 'REJECTED'`, но союз стирается до
 * Object, и ValidationPipe его не видел. Замерено на настоящем сервисе: любая
 * строка проходила насквозь и записывалась в БД как есть — и в `kycTask.status`,
 * и в `organization.kycStatus`.
 *
 * Хуже того, что строка произвольная: решение об организации принимается
 * сравнением `resolution.status === 'APPROVED'`, а ВСЁ остальное даёт
 * `'SUSPENDED'`. То есть `'approved'` в нижнем регистре не одобряло
 * организацию, а ПРИОСТАНАВЛИВАЛО её — записав при этом `kycStatus: 'approved'`,
 * из-за чего состояние организации и запись о причине расходились.
 *
 * И `resolution.status.toLowerCase()` в записи аудита падал TypeError на
 * не-строке, отдавая 500 на пользовательском вводе.
 *
 * @IsIn перечисляет ровно те два значения, которые сервис умеет обработать.
 */
export class ResolveKycTaskDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
