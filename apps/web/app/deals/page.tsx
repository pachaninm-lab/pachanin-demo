import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { NextStepBar } from '../../components/next-step-bar';
import { PageAccessGuard } from '../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../lib/route-roles';
import { apiServer } from '../../lib/api-server';

type Deal = {
  id: string; status: string; lotId: string; buyerOrgId: string; sellerOrgId: string;
  totalAmountRub: number; crop?: string; volumeTon?: number; createdAt: string;
};

const SEED: Deal[] = [
  { id: 'DEAL-001', status: 'IN_TRANSIT', lotId: 'LOT-001', buyerOrgId: 'ORG-BUYER', sellerOrgId: 'ORG-FARMER',
    totalAmountRub: 7100000, crop: 'wheat', volumeTon: 500, createdAt: '2026-03-28T10:00:00Z' },
  { id: 'DEAL-002', status: 'QUALITY_CHECK', lotId: 'LOT-002', buyerOrgId: 'ORG-BUYER2', sellerOrgId: 'ORG-FARMER',
    totalAmountRub: 3840000, crop: 'barley', volumeTon: 300, createdAt: '2026-04-01T08:00:00Z' },
  { id: 'DEAL-003', status: 'SIGNED', lotId: 'LOT-003', buyerOrgId: 'ORG-BUYER', sellerOrgId: 'ORG-FARMER2',
    totalAmountRub: 2700000, crop: 'corn', volumeTon: 200, createdAt: '2026-04-03T12:00:00Z' },
];

const STATUS_RU: Record<string, string> = {
  SIGNED: 'Подписана', IN_TRANSIT: 'В пути', QUALITY_CHECK: 'Проверка качества',
  DISPUTE_OPEN: 'Спор открыт', SETTLED: 'Расчёт завершён', CANCELLED: 'Отменена',
};
const STATUS_COLOR: Record<string, string> = {
  IN_TRANSIT: 'amber', QUALITY_CHECK: 'amber', DISPUTE_OPEN: 'red',
  SIGNED: 'green', SETTLED: 'gray', CANCELLED: 'gray',
};
const CROP_RU: Record<string, string> = { wheat: 'Пшеница', barley: 'Ячмень', corn: 'Кукуруза', sunflower: 'Подсолнечник' };

async function load(): Promise<Deal[]> {
  try {
    const res = await apiServer('/deals');
    return Array.isArray(res?.items) ? res.items : res?.length ? res : SEED;
  } catch { return SEED; }
}

export default async function DealsPage() {
  const deals = await load();
  const active = deals.filter((d) => ['SIGNED', 'IN_TRANSIT', 'QUALITY_CHECK'].includes(d.status));
  const disputes = deals.filter((d) => d.status === 'DISPUTE_OPEN');
  const settled = deals.filter((d) => d.status === 'SETTLED');
  const totalAmount = deals.reduce((s, d) => s + Number(d.totalAmountRub || 0), 0);

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]}
      title="Доступ к сделкам ограничен"
      subtitle="Управление сделками доступно участникам и операционным ролям.">
      <AppShell title="Сделки" subtitle="Все сделки внутри execution rail — от подписания до расчёта">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Сделки' }]} />

          <DetailHero
            kicker="Execution rail"
            title="Сделки под полным контролем — от подписания до расчёта"
            description="Каждая сделка проходит статусную машину: SIGNED → IN_TRANSIT → QUALITY_CHECK → SETTLED. Спор или проблема с качеством переводит в DISPUTE_OPEN."
            chips={[`всего ${deals.length}`, `активных ${active.length}`, `споров ${disputes.length}`,
              `сумма ${totalAmount.toLocaleString('ru-RU')} ₽`]}
            nextStep={active.length ? `Обработать ${active.length} активных сделок` : 'Активных сделок нет'}
            owner="farmer / buyer / logistician"
            blockers="Сделка без подписанных документов не переходит в IN_TRANSIT"
            actions={[
              { href: '/operator-cockpit', label: 'Кокпит оператора' },
              { href: '/payments', label: 'Платежи', variant: 'secondary' },
              { href: '/disputes', label: 'Споры', variant: 'secondary' },
            ]}
          />

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Всего', value: deals.length, color: '' },
              { label: 'В работе', value: active.length, color: 'amber' },
              { label: 'Споры', value: disputes.length, color: 'red' },
              { label: 'Завершено', value: settled.length, color: 'green' },
            ].map((s) => (
              <div key={s.label} className="soft-box" style={{ flex: '1 1 100px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '1.5rem' }}>{s.value}</div>
                <div className="muted small">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="section-stack">
            {deals.map((d) => (
              <div key={d.id} className="soft-box"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span className={`mini-chip ${STATUS_COLOR[d.status] || 'gray'}`}>{STATUS_RU[d.status] || d.status}</span>
                    {d.crop && <span className="muted tiny">{CROP_RU[d.crop] || d.crop}</span>}
                  </div>
                  <div style={{ fontWeight: 700 }}>{d.id} · Лот {d.lotId}</div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    {Number(d.totalAmountRub).toLocaleString('ru-RU')} ₽
                    {d.volumeTon ? ` · ${d.volumeTon} т` : ''}
                  </div>
                  <div className="muted tiny" style={{ marginTop: 4 }}>
                    Создана: {new Date(d.createdAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <Link href={`/deals/${d.id}`} className="mini-chip">Открыть →</Link>
              </div>
            ))}
          </div>

          <NextStepBar
            title="Execution rail — от подписания до расчёта"
            detail="Статусная машина сделки контролирует hold/release платежа, логистику и документооборот."
            primary={{ href: '/operator-cockpit', label: 'Кокпит оператора' }}
            secondary={[{ href: '/payments', label: 'Платежи' }, { href: '/logistics', label: 'Логистика' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
