import { validate } from 'class-validator';
import { CreateDealDto } from './create-deal.dto';

function validDto(): CreateDealDto {
  return Object.assign(new CreateDealDto(), {
    commandId: 'command-create-0001',
    idempotencyKey: 'idempotency-create-0001',
    lotId: 'LOT-0001',
    winnerBidId: 'BID-0001',
  });
}

describe('CreateDealDto authority boundary', () => {
  it('accepts only identifiers and an idempotency boundary', async () => {
    await expect(validate(validDto())).resolves.toEqual([]);
  });

  it('rejects client-authored payment terms', async () => {
    const dto = validDto() as CreateDealDto & { paymentTerms?: unknown };
    dto.paymentTerms = { advancePercent: 50 };

    const errors = await validate(dto);
    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        property: 'paymentTerms',
        constraints: expect.objectContaining({
          isEmpty: 'paymentTerms задаются только подтверждённым основанием сделки.',
        }),
      }),
    ]));
  });
});
