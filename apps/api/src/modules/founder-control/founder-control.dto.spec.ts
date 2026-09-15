import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { FounderControlUpsertDto } from './founder-control.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
const validate = (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype: FounderControlUpsertDto } as never);

describe('FounderControlUpsertDto', () => {
  it('accepts a valid founder-control mutation and strips unknown top-level fields', async () => {
    const result = await validate({
      payload: { value: 42, note: 'cash' },
      reason: 'owner correction',
      expectedVersion: '7',
      status: 'ACTIVE',
      source: 'MANUAL',
      smuggled: 'drop-me',
    });

    expect(result).toEqual({
      payload: { value: 42, note: 'cash' },
      reason: 'owner correction',
      expectedVersion: '7',
      status: 'ACTIVE',
      source: 'MANUAL',
    });
  });

  it.each([
    { payload: [], reason: 'x' },
    { payload: {}, reason: '' },
    { payload: {}, reason: 'x', expectedVersion: '-1' },
    { payload: {}, reason: 'x', expectedVersion: '1'.repeat(31) },
    { payload: {}, reason: 'x', status: 'DELETED' },
    { payload: {}, reason: 'x', source: 's'.repeat(81) },
  ])('rejects malformed bodies before they reach FounderControlService: %j', async (body) => {
    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps arbitrary payload keys because the domain payload is intentionally schema-flexible', async () => {
    const result = await validate({
      payload: { cashOnBankRub: 1_000_000, customFounderMetric: { value: 3 } },
      reason: 'update actuals',
    });

    expect(result.payload).toEqual({
      cashOnBankRub: 1_000_000,
      customFounderMetric: { value: 3 },
    });
  });
});
