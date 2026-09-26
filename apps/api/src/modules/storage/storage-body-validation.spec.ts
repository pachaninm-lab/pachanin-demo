import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RequestUploadDto } from './dto/request-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { ImportMt940Dto } from '../bank-reconciliation/dto/import-mt940.dto';
import { ManualMatchDto } from '../bank-reconciliation/dto/manual-match.dto';

/**
 * Граница запроса для storage и банковской сверки.
 *
 * Здесь ЖИВЫХ дефектов не было, и это проверено, а не предположено: сервисы
 * защищались сами — requiredIdentifier, sanitizeFilename, assertAllowedMime,
 * assertAllowedSize (Number.isSafeInteger и диапазон), normalizeSha256
 * (String(value ?? '') и ^[a-f0-9]{64}$), String(content ?? '').trim().
 * Себе исправление несуществующего дефекта здесь не приписывается.
 *
 * DTO добавляются потому, что требование — про проверку на границе: инлайн-тип
 * стирается до Object, ValidationPipe его не видит, и вся защита держалась на
 * том, что сервис не забыл проверить сам. Единственное, чего у сервиса не было
 * вовсе, — верхней границы длины выписки MT940.
 */

async function errorsFor<T extends object>(cls: new () => T, payload: unknown): Promise<string[]> {
  const result = await validate(plainToInstance(cls, payload) as object, { whitelist: true });
  return result.flatMap((item) => Object.keys(item.constraints ?? {}));
}

describe('запрос на загрузку', () => {
  const valid = { filename: 'акт.pdf', mimeType: 'application/pdf', sizeBytes: 9999, dealId: 'deal-1' };

  it('пропускает нормальный запрос', async () => {
    expect(await errorsFor(RequestUploadDto, valid)).toEqual([]);
  });

  it('отвергает размер строкой — @Type(() => Number) сюда намеренно не поставлен', async () => {
    expect(await errorsFor(RequestUploadDto, { ...valid, sizeBytes: '9999' })).toContain('isInt');
  });

  it('отвергает отрицательный, нулевой и дробный размер', async () => {
    expect(await errorsFor(RequestUploadDto, { ...valid, sizeBytes: -1 })).toContain('min');
    expect(await errorsFor(RequestUploadDto, { ...valid, sizeBytes: 0 })).toContain('min');
    expect(await errorsFor(RequestUploadDto, { ...valid, sizeBytes: 1.5 })).toContain('isInt');
  });

  it('отвергает NaN и бесконечность', async () => {
    expect(await errorsFor(RequestUploadDto, { ...valid, sizeBytes: Number.NaN })).toContain('isInt');
    expect(await errorsFor(RequestUploadDto, { ...valid, sizeBytes: Number.POSITIVE_INFINITY })).toContain('isInt');
  });

  it('отвергает пустое и слишком длинное имя файла', async () => {
    expect(await errorsFor(RequestUploadDto, { ...valid, filename: '' })).toContain('minLength');
    expect(await errorsFor(RequestUploadDto, { ...valid, filename: 'a'.repeat(256) })).toContain('maxLength');
  });

  it('отвергает отсутствующий dealId', async () => {
    expect(await errorsFor(RequestUploadDto, { ...valid, dealId: undefined })).toContain('isString');
  });
});

describe('подтверждение загрузки', () => {
  const hash = 'a'.repeat(64);

  it('пропускает настоящий sha256 в обоих регистрах', async () => {
    expect(await errorsFor(ConfirmUploadDto, { sha256: hash })).toEqual([]);
    expect(await errorsFor(ConfirmUploadDto, { sha256: hash.toUpperCase() })).toEqual([]);
  });

  it('отвергает не-hex, не ту длину и не строку', async () => {
    expect(await errorsFor(ConfirmUploadDto, { sha256: 'z'.repeat(64) })).toContain('matches');
    expect(await errorsFor(ConfirmUploadDto, { sha256: 'a'.repeat(63) })).toContain('matches');
    expect(await errorsFor(ConfirmUploadDto, { sha256: 12345 })).toContain('matches');
  });
});

describe('импорт выписки MT940', () => {
  it('пропускает нормальную выписку', async () => {
    expect(await errorsFor(ImportMt940Dto, { content: ':20:BATCH\n:61:2601010101D100,00NTRF' })).toEqual([]);
  });

  it('отвергает пустую выписку и не-строку', async () => {
    expect(await errorsFor(ImportMt940Dto, { content: '' })).toContain('isNotEmpty');
    expect(await errorsFor(ImportMt940Dto, { content: 12345 })).toContain('isString');
  });

  it('отвергает выписку сверх 4 МБ — единственное, чего у сервиса не было вовсе', async () => {
    expect(await errorsFor(ImportMt940Dto, { content: 'x'.repeat(4 * 1024 * 1024 + 1) })).toContain('maxLength');
  });

  it('настоящая месячная выписка в границу укладывается с запасом', async () => {
    // Реальная MT940 за месяц — десятки килобайт; 512 КБ здесь заведомо больше.
    expect(await errorsFor(ImportMt940Dto, { content: 'x'.repeat(512 * 1024) })).toEqual([]);
  });
});

describe('ручное сопоставление', () => {
  it('пропускает оба имени поля: entryId и прежнее paymentId', async () => {
    expect(await errorsFor(ManualMatchDto, { entryId: 'e1', dealId: 'd1' })).toEqual([]);
    expect(await errorsFor(ManualMatchDto, { paymentId: 'p1', dealId: 'd1' })).toEqual([]);
  });

  it('dealId обязателен', async () => {
    expect(await errorsFor(ManualMatchDto, { entryId: 'e1' })).toContain('isString');
    expect(await errorsFor(ManualMatchDto, { entryId: 'e1', dealId: '' })).toContain('minLength');
  });
});
