import { randomUUID } from 'crypto';
import { sha256, stableJson } from './auth-crypto';
import { AuthSqlClient, PersistentAuthRepository } from './persistent-auth.repository';

/**
 * Единственная реализация записи в цепочку auth-аудита.
 *
 * Продуктовая сессия пишет в ту же цепочку и тем же способом, что и
 * платформенная: отдельного журнала у Гекты нет. Позиция в цепочке входит в
 * подписываемый факт, поэтому переставленное или повторно записанное событие
 * не может предъявить тот же хеш с другого места.
 */
export type AuthAuditEvent = {
  userId?: string | null;
  sessionId?: string | null;
  membershipId?: string | null;
  organizationId?: string | null;
  tenantId?: string | null;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function appendAuthAudit(
  repository: PersistentAuthRepository,
  tx: AuthSqlClient,
  input: AuthAuditEvent,
): Promise<void> {
  const id = `auth_evt_${randomUUID()}`;
  const { chainKey, prevHash, nextSequence } = await repository.latestAuditChainPosition(
    tx,
    input.userId,
    input.sessionId,
  );
  const hash = sha256(stableJson({
    id, ...input, prevHash, chainKey, chainSequence: nextSequence.toString(),
  }));
  await repository.insertAudit(tx, {
    id, ...input, hash, prevHash, chainSequence: nextSequence,
  });
}
