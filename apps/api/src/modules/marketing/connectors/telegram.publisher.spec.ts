import { TelegramPublisher } from './telegram.publisher';

const TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi';
const CHAT = '@transparent_price_test';

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe('TelegramPublisher', () => {
  const originalToken = process.env.MARKETING_TELEGRAM_BOT_TOKEN;
  const originalChat = process.env.MARKETING_TELEGRAM_CHANNEL_ID;

  beforeEach(() => {
    process.env.MARKETING_TELEGRAM_BOT_TOKEN = TOKEN;
    process.env.MARKETING_TELEGRAM_CHANNEL_ID = CHAT;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalToken === undefined) delete process.env.MARKETING_TELEGRAM_BOT_TOKEN;
    else process.env.MARKETING_TELEGRAM_BOT_TOKEN = originalToken;
    if (originalChat === undefined) delete process.env.MARKETING_TELEGRAM_CHANNEL_ID;
    else process.env.MARKETING_TELEGRAM_CHANNEL_ID = originalChat;
  });

  it('publishes plain text through the official Bot API sendMessage endpoint', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      response({ ok: true, result: { message_id: 42, chat: { id: -100123 } } }),
    );

    const result = await new TelegramPublisher().publish('  Полезный разбор сделки  ');

    expect(result).toEqual({ externalId: '42' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('error');
    expect(JSON.parse(String(init?.body))).toEqual({
      chat_id: CHAT,
      text: 'Полезный разбор сделки',
    });
  });

  it('fails before any network call when credentials are absent', async () => {
    delete process.env.MARKETING_TELEGRAM_BOT_TOKEN;
    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(new TelegramPublisher().publish('text')).rejects.toThrow(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed bot tokens before a network call', async () => {
    process.env.MARKETING_TELEGRAM_BOT_TOKEN = 'not-a-token';
    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(new TelegramPublisher().publish('text')).rejects.toThrow(/token format/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not leak a bot token through transport errors', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error(`request to /bot${TOKEN}/sendMessage failed`));

    await expect(new TelegramPublisher().publish('text')).rejects.toThrow(
      'Telegram publish transport failed.',
    );
  });

  it('rejects content outside Telegram sendMessage text limits', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(new TelegramPublisher().publish('')).rejects.toThrow(/1-4096/);
    await expect(new TelegramPublisher().publish('x'.repeat(4097))).rejects.toThrow(/1-4096/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed on an upstream non-success response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ ok: false }, 429));

    await expect(new TelegramPublisher().publish('text')).rejects.toThrow(/HTTP 429/);
  });
});
