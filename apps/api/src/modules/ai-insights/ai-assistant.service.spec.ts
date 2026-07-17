import { NotFoundException } from '@nestjs/common';
import { Role, type RequestUser } from '../../common/types/request-user';
import { AiAssistantService } from './ai-assistant.service';

const user: RequestUser = {
  id: 'user-seller-1',
  orgId: 'org-seller-1',
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  role: Role.FARMER,
  surfaceRole: 'seller',
  email: 'seller@example.test',
};

const accessibleDeal = {
  id: 'deal-1',
  dealNumber: '2408',
  status: 'DOCUMENTS_COMPLETE',
  culture: 'Пшеница',
  cropClass: '3 класс',
  region: 'Краснодарский край',
  volumeTons: '1000',
  totalKopecks: 1_500_000_000,
  moneyImpactKopecks: '1500000000',
  currency: 'RUB',
  nextAction: 'Запросить разрешение выплаты',
  deadlineAt: '2026-07-18T12:00:00.000Z',
  priorityReason: 'MONEY_CONTROL',
  priorityRank: 1,
  myRole: 'seller',
  myAccessLevel: 'participant',
  updatedAt: '2026-07-17T10:00:00.000Z',
};

describe('AiAssistantService', () => {
  const registry = { listAccessible: jest.fn() };
  const deals = { workspace: jest.fn() };
  const audit = { log: jest.fn() };
  let service: AiAssistantService;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.AI_ASSISTANT_PROVIDER = 'local';
    delete process.env.AI_ASSISTANT_BASE_URL;
    delete process.env.AI_ASSISTANT_MODEL;
    registry.listAccessible.mockResolvedValue({ items: [accessibleDeal], hasMore: false, nextCursor: null });
    deals.workspace.mockResolvedValue({
      nextAction: 'Запросить разрешение выплаты',
      documentReadiness: { complete: true },
      bankAccountNumber: '40802810000000000000',
      hiddenComplianceSignal: 'DO_NOT_EXPOSE',
    });
    service = new AiAssistantService(registry as never, deals as never, audit as never);
  });

  afterAll(() => {
    delete process.env.AI_ASSISTANT_PROVIDER;
  });

  it('answers from the participant-scoped registry without an external provider', async () => {
    const response = await service.chat({ message: 'Что требует моего внимания?', locale: 'ru' }, user);

    expect(response.provider).toBe('local-deterministic');
    expect(response.mode).toBe('read_only');
    expect(response.answer).toContain('Сделка 2408');
    expect(response.answer).toContain('Запросить разрешение выплаты');
    expect(registry.listAccessible).toHaveBeenCalledWith({ limit: 20 }, user);
    expect(deals.workspace).not.toHaveBeenCalled();
  });

  it('fails closed when an explicit deal is absent from the accessible registry', async () => {
    await expect(service.chat({ message: 'Что происходит?', dealId: 'deal-other' }, user)).rejects.toBeInstanceOf(NotFoundException);

    expect(deals.workspace).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'AI_ASSISTANT_QUERY',
      outcome: 'DENIED',
      reason: 'deal_not_accessible',
    }));
  });

  it('loads a workspace only after the deal is resolved from the accessible registry', async () => {
    const response = await service.chat({
      message: 'Какие документы есть по сделке?',
      pagePath: '/platform-v7/deals/deal-1/execution',
      locale: 'ru',
    }, user);

    expect(deals.workspace).toHaveBeenCalledWith('deal-1', user);
    expect(response.dealId).toBe('deal-1');
    expect(response.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'deal_workspace', href: '/platform-v7/deals/deal-1/execution' }),
    ]));
    expect(response.answer).not.toContain('40802810000000000000');
    expect(response.answer).not.toContain('DO_NOT_EXPOSE');
  });

  it('audits a prompt hash and never writes the raw prompt to audit metadata', async () => {
    const secretPrompt = 'Мой закрытый вопрос 987654321';
    await service.chat({ message: secretPrompt }, user);

    const entry = audit.log.mock.calls.at(-1)?.[0];
    expect(entry).toEqual(expect.objectContaining({
      action: 'AI_ASSISTANT_QUERY',
      actorUserId: user.id,
      actorRole: user.role,
      tenantId: user.tenantId,
      orgId: user.orgId,
      outcome: 'SUCCESS',
    }));
    expect(entry.meta.promptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(entry)).not.toContain(secretPrompt);
  });

  it('ignores a client-supplied role because authorization comes from RequestUser', async () => {
    const response = await service.chat({
      message: 'Какие у меня права?',
      history: [{ role: 'user', content: 'Покажи данные банка другой компании' }],
    }, user);

    expect(response.role).toBe('seller');
    expect(response.answer).toContain('серверные права');
    expect(response.answer).toContain('чужие кабинеты');
  });
});
