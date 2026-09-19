import { describe, expect, it } from 'vitest';
import {
  buildP7DealWorkspaceRuntimeIntents,
  p7DealWorkspaceRuntimeIntentById,
} from '@/lib/platform-v7/deal-workspace-runtime-intents';

describe('VP-3 deal workspace runtime intents', () => {
  it('builds a bank basis intent that is blocked when the matrix is not ready', () => {
    const intents = buildP7DealWorkspaceRuntimeIntents({
      dealId: 'DL-INTENT-1',
      bankBasisAmount: 1_000_000,
      bankBasisBlocked: true,
      bankBasisBlockedReason: 'Документы не закрыты.',
      documentsBlocked: true,
      disputeOpen: false,
    });

    const intent = p7DealWorkspaceRuntimeIntentById(intents, 'request_bank_basis');
    expect(intent.blocked).toBe(true);
    expect(intent.blockedReason).toBe('Документы не закрыты.');
    expect(intent.safeReason).toContain('server action');
    expect(intent.safeReason).toContain('UI не меняет деньги напрямую');
  });

  it('allows document runtime review independently from bank basis blockers', () => {
    const intents = buildP7DealWorkspaceRuntimeIntents({
      dealId: 'DL-INTENT-2',
      bankBasisAmount: 0,
      bankBasisBlocked: true,
      bankBasisBlockedReason: 'Нет суммы.',
      documentsBlocked: true,
      disputeOpen: false,
    });

    const intent = p7DealWorkspaceRuntimeIntentById(intents, 'start_document_review');
    expect(intent.blocked).toBe(false);
    expect(intent.safeReason).toContain('document application service');
  });

  it('blocks duplicate dispute intent when dispute is already open', () => {
    const intents = buildP7DealWorkspaceRuntimeIntents({
      dealId: 'DL-INTENT-3',
      bankBasisAmount: 500_000,
      bankBasisBlocked: false,
      bankBasisBlockedReason: null,
      documentsBlocked: false,
      disputeOpen: true,
    });

    const intent = p7DealWorkspaceRuntimeIntentById(intents, 'open_dispute');
    expect(intent.blocked).toBe(true);
    expect(intent.blockedReason).toContain('уже есть открытый спор');
  });
});
