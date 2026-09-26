import { Matches } from 'class-validator';

/**
 * Подтверждение загрузки заявленным хешем.
 *
 * Живого дефекта здесь тоже не было: normalizeSha256 в сервисе приводит через
 * String(value ?? '') и требует ^[a-f0-9]{64}$, поэтому не-строка и мусор
 * отвергались и раньше. Граница повторяет ту же форму, а не другую: две разные
 * формы одного и того же ограничения — это способ развести их со временем.
 */
export class ConfirmUploadDto {
  @Matches(/^[a-fA-F0-9]{64}$/u, { message: 'sha256 must be 64 hexadecimal characters' })
  sha256!: string;
}
