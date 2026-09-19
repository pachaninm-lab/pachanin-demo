import { AuthController } from './auth.controller';

describe('AuthController password-reset request boundary', () => {
  it('preserves the Web correlation id and requested locale for durable auth-mail', async () => {
    const passwordReset = {
      request: jest.fn().mockResolvedValue({ accepted: true }),
    };
    const controller = new AuthController(
      {} as never,
      {} as never,
      passwordReset as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await controller.requestPasswordReset(
      { email: 'reviewer@example.com', locale: 'zh' },
      'delivery-key-that-is-longer-than-thirty-two-characters',
      'reset-correlation-20260816',
      '203.0.113.77',
    );

    expect(result).toEqual({ accepted: true });
    expect(passwordReset.request).toHaveBeenCalledTimes(1);
    expect(passwordReset.request).toHaveBeenCalledWith(
      'reviewer@example.com',
      '203.0.113.77',
      'delivery-key-that-is-longer-than-thirty-two-characters',
      'reset-correlation-20260816',
      'zh',
    );
  });
});
