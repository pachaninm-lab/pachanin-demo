'use client';

import * as React from 'react';
import Link from 'next/link';
import { CanonicalDealWorkspace } from '@/components/platform-v7/CanonicalDealWorkspace';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

/**
 * Every role opens the same canonical Deal Workspace.
 *
 * После входа пользователь сразу видит СВОЮ сделку: дашборд запрашивает
 * participant-scoped список (скоуп определяет PostgreSQL) и открывает самую
 * свежую сделку. Если подтверждённых сделок нет или backend недоступен,
 * остаётся каноническая тестовая сделка — прежнее поведение, без выдуманных
 * данных.
 *
 * Role-specific differences are supplied by the authenticated backend projection:
 * facts, identifiers and deal state never diverge between cabinets.
 */
export function RoleIntentDashboard({ role }: { role: PlatformRole }) {
  const [dealId, setDealId] = React.useState<string | null>(null);
  const [total, setTotal] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/proxy/deals/accessible?limit=5', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        const items = response.ok && Array.isArray(payload?.items) ? (payload.items as Array<{ id: string }>) : [];
        setTotal(items.length);
        setDealId(items[0]?.id ?? '');
      } catch {
        if (!cancelled) setDealId('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Пока список не разрешён, не монтируем workspace, чтобы не мигать
  // канонической сделкой перед реальной.
  if (dealId === null) return null;

  return (
    <>
      {total > 1 ? (
        <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--pc-text-secondary, #475569)', fontWeight: 800 }}>
          У вас {total} активных сделок. <Link href='/platform-v7/deals' style={{ color: '#0A7A5F' }}>Все сделки</Link>
        </p>
      ) : null}
      {/* '' = список недоступен/пуст → канонический default внутри workspace */}
      {dealId ? <CanonicalDealWorkspace role={role} dealId={dealId} /> : <CanonicalDealWorkspace role={role} />}
    </>
  );
}
