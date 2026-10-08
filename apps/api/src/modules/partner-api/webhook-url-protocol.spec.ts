import { BadRequestException } from '@nestjs/common';
import { PartnerApiService } from './partner-api.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { PartnerApiController } from './partner-api.controller';
import { Role, type RequestUser } from '../../common/types/request-user';
import { outboundUrlProblem, isSafeOutboundUrl } from '../../common/security/outbound-url';

/**
 * ASVS 5.0 V1.2.2: when a URL is accepted from untrusted data, only safe
 * protocols may be permitted, and javascript: and data: must be disallowed.
 *
 * A partner registers a webhook URL through the partner API. It was stored
 * verbatim - the endpoint declares its body as an inline TypeScript type,
 * which erases at runtime, so ValidationPipe never saw the field - and neither
 * place that later fetches it checked anything.
 *
 * There are two such places, and the earlier security record named only one of
 * them: WebhookDispatcherService.dispatch(). That method has no runtime caller
 * anywhere in the tree. The fetch a partner can actually reach is in the
 * controller's test endpoint. Both are covered here, and the reachable one is
 * covered first.
 */

const PARTNER: RequestUser = {
  id: 'u-1',
  orgId: 'org-1',
  role: Role.ADMIN,
  email: 'partner@example.test',
};

const UNSAFE = [
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'file:///etc/passwd',
  'ftp://example.test/x',
  'gopher://example.test/x',
  'ws://example.test/x',
  'not a url at all',
  '',
];

function harness() {
  const partnerApi = new PartnerApiService(undefined as never);
  const dispatcher = new WebhookDispatcherService(partnerApi);
  const controller = new PartnerApiController(partnerApi, dispatcher);
  return { partnerApi, dispatcher, controller };
}

/** Registers a subscription bypassing the endpoint, as a pre-existing row would be. */
function seedSubscriptionDirectly(partnerApi: PartnerApiService, url: string): string {
  const store = (partnerApi as unknown as { webhooks: Map<string, unknown> }).webhooks;
  const id = 'wh-legacy';
  store.set(id, {
    id,
    orgId: PARTNER.orgId,
    url,
    events: ['test.ping'],
    secret: 'whsec_test',
    active: true,
    createdAt: new Date().toISOString(),
  });
  return id;
}

describe('an unsafe URL scheme is refused at registration', () => {
  it.each(UNSAFE)('refuses %p', (url) => {
    const { partnerApi } = harness();
    expect(() => partnerApi.subscribeWebhook({ url, events: ['deal.created'] }, PARTNER))
      .toThrow(BadRequestException);
  });

  it('accepts https and http, which are the schemes a webhook may use', () => {
    const { partnerApi } = harness();
    expect(() => partnerApi.subscribeWebhook({ url: 'https://partner.example.test/hook', events: ['x'] }, PARTNER))
      .not.toThrow();
    expect(() => partnerApi.subscribeWebhook({ url: 'http://partner.example.test/hook', events: ['x'] }, PARTNER))
      .not.toThrow();
  });

  it('refuses a URL carrying credentials, which would be sent on every delivery', () => {
    const { partnerApi } = harness();
    expect(() => partnerApi.subscribeWebhook({ url: 'https://u:p@partner.example.test/hook', events: ['x'] }, PARTNER))
      .toThrow(BadRequestException);
  });
});

describe('the reachable path routes through the outbound guard', () => {
  /**
   * The transport is no longer global fetch, so a fetch spy would pass every
   * case while proving nothing. These use destinations that are refused from
   * the literal address alone - no DNS, no socket - and assert the refusal
   * reaches the caller. The guard's own behaviour is covered in
   * safe-outbound-request.spec.ts, where the transport is injectable.
   */
  it.each([
    ['javascript:alert(1)', 'OUTBOUND_URL_PROTOCOL_NOT_ALLOWED'],
    ['file:///etc/passwd', 'OUTBOUND_URL_PROTOCOL_NOT_ALLOWED'],
    ['not a url at all', 'OUTBOUND_URL_UNPARSEABLE'],
    ['http://127.0.0.1/hook', 'ADDRESS_LOOPBACK'],
    ['http://169.254.169.254/latest/meta-data/', 'ADDRESS_LINK_LOCAL'],
    ['http://10.0.0.1/hook', 'ADDRESS_PRIVATE'],
  ])('surfaces the refusal for %p from the test endpoint', async (url, reason) => {
    const { partnerApi, controller } = harness();
    const id = seedSubscriptionDirectly(partnerApi, url);

    const result = await controller.testWebhook(id, {}, PARTNER) as
      { delivered: boolean; error?: string };

    expect(result.delivered).toBe(false);
    expect(result.error).toBe(reason);
  });

  it('the dispatcher refuses a stored row too, and keeps going', async () => {
    const { partnerApi, dispatcher } = harness();
    seedSubscriptionDirectly(partnerApi, 'http://169.254.169.254/latest/meta-data/');

    const results = await dispatcher.dispatch('test.ping', {});

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('failed');
    expect(results[0].error).toBe('ADDRESS_LINK_LOCAL');
  });
});

describe('the check itself', () => {
  it('names why it refused, rather than returning a bare boolean', () => {
    expect(outboundUrlProblem('javascript:alert(1)')).toBe('OUTBOUND_URL_PROTOCOL_NOT_ALLOWED');
    expect(outboundUrlProblem('data:text/plain,x')).toBe('OUTBOUND_URL_PROTOCOL_NOT_ALLOWED');
    expect(outboundUrlProblem('https://u:p@h.test/')).toBe('OUTBOUND_URL_HAS_CREDENTIALS');
    expect(outboundUrlProblem('nonsense')).toBe('OUTBOUND_URL_UNPARSEABLE');
    expect(outboundUrlProblem(null)).toBe('OUTBOUND_URL_UNPARSEABLE');
    expect(outboundUrlProblem('https://h.test/ok')).toBeNull();
  });

  it('does not claim to decide where the URL points', () => {
    // Loopback and private ranges pass this check. That is SSRF - V1.3.6 -
    // and it is deliberately not claimed here. Asserting it so the boundary
    // is visible in the suite rather than only in prose.
    expect(isSafeOutboundUrl('http://127.0.0.1:8080/x')).toBe(true);
    expect(isSafeOutboundUrl('http://169.254.169.254/latest/meta-data/')).toBe(true);
  });
});
