import { createHash } from 'node:crypto';
import { VkPublisher } from './vk.publisher';

const TOKEN = 'vk1.a.example-secret-token';
const GROUP_ID = '123456789';

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe('VkPublisher', () => {
  const originalToken = process.env.MARKETING_VK_USER_ACCESS_TOKEN;
  const originalGroup = process.env.MARKETING_VK_GROUP_ID;

  beforeEach(() => {
    process.env.MARKETING_VK_USER_ACCESS_TOKEN = TOKEN;
    process.env.MARKETING_VK_GROUP_ID = GROUP_ID;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalToken === undefined) delete process.env.MARKETING_VK_USER_ACCESS_TOKEN;
    else process.env.MARKETING_VK_USER_ACCESS_TOKEN = originalToken;
    if (originalGroup === undefined) delete process.env.MARKETING_VK_GROUP_ID;
    else process.env.MARKETING_VK_GROUP_ID = originalGroup;
  });

  it('publishes to the community through official wall.post with stable guid', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      response({ response: { post_id: 77 } }),
    );

    const result = await new VkPublisher().publish('  Разбор сделки  ', 'cmd-42', false);

    expect(result).toEqual({ externalId: '77' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.vk.com/method/wall.post');
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('error');

    const body = init?.body as URLSearchParams;
    expect(body.get('v')).toBe('5.199');
    expect(body.get('owner_id')).toBe(`-${GROUP_ID}`);
    expect(body.get('from_group')).toBe('1');
    expect(body.get('message')).toBe('Разбор сделки');
    expect(body.get('access_token')).toBe(TOKEN);
    expect(body.get('mark_as_ads')).toBe('0');
    expect(body.get('guid')).toBe(createHash('sha256').update('cmd-42').digest('hex'));
  });

  it('sets VK advertising flag only for content already classified as advertising', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(response({ response: { post_id: 78 } }));

    await new VkPublisher().publish('Реклама. Платформа для АПК', 'ad-1', true);

    const body = fetchMock.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get('mark_as_ads')).toBe('1');
  });

  it('fails before network when credentials, group or idempotency authority is invalid', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');

    delete process.env.MARKETING_VK_USER_ACCESS_TOKEN;
    await expect(new VkPublisher().publish('text', 'key', false)).rejects.toThrow(/not configured/i);

    process.env.MARKETING_VK_USER_ACCESS_TOKEN = TOKEN;
    process.env.MARKETING_VK_GROUP_ID = '-123';
    await expect(new VkPublisher().publish('text', 'key', false)).rejects.toThrow(/invalid/i);

    process.env.MARKETING_VK_GROUP_ID = GROUP_ID;
    await expect(new VkPublisher().publish('text', '   ', false)).rejects.toThrow(/idempotency/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not leak an access token through transport errors', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error(`request body contained ${TOKEN}`));

    await expect(new VkPublisher().publish('text', 'key', false)).rejects.toThrow(
      'VK publish transport failed.',
    );
  });

  it('fails closed on a VK API error even when HTTP is 200', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      response({ error: { error_code: 214, error_msg: `secret ${TOKEN}` } }),
    );

    await expect(new VkPublisher().publish('text', 'key', false)).rejects.toThrow(
      'VK publish failed API code 214.',
    );
  });
});
