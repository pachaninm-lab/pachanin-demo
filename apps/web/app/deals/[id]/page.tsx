import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/app-shell';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { NextStepBar } from '../../../components/next-step-bar';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../../lib/route-roles';
import { apiServer } from '../../../lib/api-server';

type Deal = {
  id: string; lotId: string; status: string; sellerOrgId: string; buyerOrgId: string;
  volumeTons: number; pricePerTon: number; totalRub: number; currency: string;
  region: string; culture: string; createdAt: string; signedAt?: string; updatedAt?: string;
  timeline?: { status: string; label: string; timestamp: string; actor?: string }[];
  nextAction?: string; blockers?: string[];
};

const SEED: Record<string, Deal> = {
  'DEAL-001': { id: 'DEAL-001', lotId: 'LOT-001', status: 'IN_TRANSIT', sellerOrgId: 'org-farmer-1', buyerOrgId: 'org-buyer-1', volumeTons: 500, pricePerTon: 12750, totalRub: 6375000, currency: 'RUB', region: 'Тамбовская область', culture: 'wheat', createdAt: '2026-03-22T10:00:00Z', signedAt: '2026-03-25T12:00:00Z', nextAction: 'Ожидать прибытия груза на элеватор' },
  'DEAL-002': { id: 'DEAL-002', lotId: 'LOT-003', status: 'QUALITY_CHECK', sellerOrgId: 'org-farmer-1', buyerOrgId: 'org-buyer-2', volumeTons: 750, pricePerTon: 11500, totalRub: 8625000, currency: 'RUB', region: 'Краснодарский край', culture: 'corn', createdAt: '2026-03-18T10:00:00Z', signedAt: '2026-03-20T09:00:00Z', nextAction: 'Лаборатория должна выдать протокол' },
  'DEAL-003': { id: 'DEAL-003', lotId: 'LOT-002', status: 'SIGNED', sellerOrgId: 'org-farmer-2', buyerOrgId: 'org-buyer-1', volumeTons: 300, pricePerTon: 11000, totalRub: 3300000, currency: 'RUB', region: 'Воронежская область', culture: 'barley', createdAt: '2026-04-01T10:00:00Z', nextAction: 'Организовать логистику и начать погрузку' },
};

const STATUS_RU: Record<string, string> = {
  DRAFT: 'Черновик', AWAITING_SIGN: 'Ожидает подписи', SIGNED: 'Подписана',
  PREPAYMENT_RESERVED: 'Предоплата резервирована', LOADING: 'Погрузка',
  IN_TRANSIT: 'В пути', ARRIVED: 'Прибыл', QUALITY_CHECK: 'Проверка качества',
  ACCEPTED: 'Принят', FINAL_PAYMENT: 'Финальный платёж', SETTLED: 'Расчёт завершён',
  CLOSED: 'Закрыт', DISPUTE_OPEN: 'Спор открыт', EXPERTISE: 'Экспертиза',
  ARBITRATION_DECISION: 'Решение арбитража', PARTIAL_SETTLEMENT: 'Частичный расчёт',
  CANCELLATION: 'Отмена',
};
const STATUS_COLOR: Record<string, string> = {
  IN_TRANSIT: 'amber', QUALITY_CHECK: 'amber', LOADING: 'amber', ARRIVED: 'amber', FINAL_PAYMENT: 'amber',
  DISPUTE_OPEN: 'red', EXPERTISE: 'red', ARBITRATION_DECISION: 'red', CANCELLATION: 'red',
  SIGNED: 'green', ACCEPTED: 'green', PREPAYMENT_RESERVED: 'green',
  SETTLED: 'gray', CLOSED: 'gray', DRAFT: 'gray', AWAITING_SIGN: 'gray',
};
const CULTURE_RU: Record<string, string> = { wheat: 'Пшеница', barley: 'Ячмень', corn: 'Кукуруза', sunflower: 'Подсолнечник' };

const DEAL_STAGES = [
  { key: 'SIGNED', label: 'Подписана' },
  { key: 'PREPAYMENT_RESERVED', label: 'Предоплата' },
  { key: 'LOADING', label: 'Погрузка' },
  { key: 'IN_TRANSIT', label: 'В пути' },
  { key: 'ARRIVED', label: 'Прибыл' },
  { key: 'QUALITY_CHECK', label: 'Качество' },
  { key: 'ACCEPTED', label: 'Принят' },
  { key: 'FINAL_PAYMENT', label: 'Финплатёж' },
  { key: 'SETTLED', label: 'Расчёт' },
];

async function load(id: string): Promise<Deal | null> {
  try {
    const res = await apiServer(`/deals/${id}/workspace`);
    return res?.id ? res : SEED[id] ?? null;
  } catch {
    return SEED[id] ?? null;
  }
}

function StatusRail({ status }: { status: string }) {
  const idx = DEAL_STAGES.findIndex((s) => s.key === status);
  if (idx < 0) return null;
  return (
    <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
      {DEAL_STAGES.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} style={{
            flex: '1 1 60px', minWidth: 56, padding: '6px 4px', textAlign: 'center',
            fontSize: '0.68rem', fontWeight: active ? 700 : 400,
            background: active ? 'var(--color-amber-soft, #fef3c7)' : done ? 'var(--color-green-soft, #f0fdf4)' : 'var(--color-surface-2, #f3f4f6)',
            borderRadius: i === 0 ? '6px 0 0 6px' : i === DEAL_STAGES.length - 1 ? '0 6px 6px 0' : 0,
            borderRight: i < DEAL_STAGES.length - 1 ? '1px solid var(--color-border, #e5e7eb)' : undefined,
            color: active ? '#92400e' : done ? '#166534' : 'var(--color-muted, #6b7280)',
          }}>
            {done ? '✓ ' : ''}{s.label}
          </div>
        );
      })}
    </div>
  );
}

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const deal = await load(params.id);
  if (!deal) notFound();

  const totalRub = Number(deal.totalRub || 0);
  const pricePerTon = Number(deal.pricePerTon || 0);
  const volumeTons = Number(deal.volumeTons || 0);
  const cultureRu = CULTURE_RU[deal.culture] || deal.culture;

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]}
      title="Доступ к сделке ограничен"
      subtitle="Детали сделки доступны участникам и операционным ролям.">
      <AppShell title={`Сделка ${deal.id}`} subtitle={`${cultureRu} · ${deal.region}`}>
        <div className="space-y-6">
          <Breadcrumbs items={[
            { href: '/', label: 'Главная' },
            { href: '/deals', label: 'Сделки' },
            { label: deal.id },
          ]} />

          {/* Status rail */}
          <StatusRail status={deal.status} />

          <DetailHero
            kicker={deal.id}
            title={`${cultureRu} · ${volumeTons.toLocaleString('ru-RU')} т · ${totalRub.toLocaleString('ru-RU')} ₽`}
            description={`Сделка между ${deal.sellerOrgId} и ${deal.buyerOrgId}. Регион: ${deal.region}. Цена: ${pricePerTon.toLocaleString('ru-RU')} ₽/т.`}
            chips={[STATUS_RU[deal.status] || deal.status, cultureRu, deal.region, `${volumeTons} т`]}
            nextStep={deal.nextAction || 'Нет активных действий'}
            owner={`Продавец: ${deal.sellerOrgId} / Покупатель: ${deal.buyerOrgId}`}
            blockers={deal.blockers?.join(' · ') || 'Блокеров нет'}
            actions={[
              // Status-specific primary CTA
              ...(deal.status === 'SIGNED' ? [{ href: '/dispatch', label: 'Организовать доставку →' }] : []),
              ...(deal.status === 'IN_TRANSIT' || deal.status === 'LOADING' ? [{ href: '/dispatch', label: 'Отслеживать рейс →' }] : []),
              ...(deal.status === 'QUALITY_CHECK' || deal.status === 'ARRIVED' ? [{ href: `/lab/${deal.id}`, label: 'Открыть пробу →' }] : []),
              ...(deal.status === 'ACCEPTED' ? [{ href: '/settlement', label: 'Перейти в расчёт →' }] : []),
              ...(deal.status === 'FINAL_PAYMENT' ? [{ href: '/payments', label: 'Подтвердить платёж →' }] : []),
              ...(deal.status === 'DISPUTE_OPEN' ? [{ href: '/disputes', label: 'Открыть спор →' }] : []),
              // Always-available secondary actions
              { href: `/deals/${deal.id}/passport`, label: 'Паспорт сделки', variant: 'secondary' as const },
              { href: `/deals/${deal.id}/timeline`, label: 'Timeline', variant: 'secondary' as const },
              { href: `/lots/${deal.lotId}`, label: `Лот ${deal.lotId}`, variant: 'secondary' as const },
            ].filter(Boolean)}
          />

          {/* Key metrics */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Объём', value: `${volumeTons.toLocaleString('ru-RU')} т` },
              { label: 'Цена/т', value: `${pricePerTon.toLocaleString('ru-RU')} ₽` },
              { label: 'Сумма', value: `${totalRub.toLocaleString('ru-RU')} ₽` },
              { label: 'Валюта', value: deal.currency || 'RUB' },
            ].map((m) => (
              <div key={m.label} className="soft-box" style={{ flex: '1 1 100px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{m.value}</div>
                <div className="muted small">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Status + dates */}
          <div className="soft-box">
            <div className="section-title" style={{ marginBottom: 8 }}>Статус и даты</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className={`mini-chip ${STATUS_COLOR[deal.status] || 'gray'}`}>
                {STATUS_RU[deal.status] || deal.status}
              </span>
              {deal.status === 'DISPUTE_OPEN' && (
                <Link href="/disputes" className="mini-chip red">Споры →</Link>
              )}
            </div>
            <div className="muted small">
              Создана: {new Date(deal.createdAt).toLocaleDateString('ru-RU')}
              {deal.signedAt ? ` · Подписана: ${new Date(deal.signedAt).toLocaleDateString('ru-RU')}` : ''}
              {deal.updatedAt ? ` · Обновлена: ${new Date(deal.updatedAt).toLocaleDateString('ru-RU')}` : ''}
            </div>
          </div>

          {/* Parties */}
          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>Стороны</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className="soft-box" style={{ flex: '1 1 200px' }}>
                <div className="muted small">Продавец (FARMER)</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>{deal.sellerOrgId}</div>
                <div className="muted tiny">{deal.region}</div>
              </div>
              <div className="soft-box" style={{ flex: '1 1 200px' }}>
                <div className="muted small">Покупатель (BUYER)</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>{deal.buyerOrgId}</div>
              </div>
            </div>
          </div>

          {/* Timeline preview */}
          {deal.timeline && deal.timeline.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div className="section-title">Последние события</div>
                <Link href={`/deals/${deal.id}/timeline`} className="mini-chip">Все →</Link>
              </div>
              <div className="section-stack">
                {[...deal.timeline].reverse().slice(0, 4).map((t, i) => (
                  <div key={i} className="soft-box" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 80, fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--color-muted, #6b7280)', paddingTop: 2 }}>
                      {new Date(t.timestamp).toLocaleDateString('ru-RU')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{STATUS_RU[t.status] || t.status}</div>
                      <div className="muted tiny">{t.label}{t.actor ? ` · ${t.actor}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related modules */}
          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>Связанные модули</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { href: `/deals/${deal.id}/passport`, label: 'Паспорт' },
                { href: `/deals/${deal.id}/timeline`, label: 'Timeline' },
                { href: '/logistics', label: 'Логистика' },
                { href: '/documents', label: 'Документы' },
                { href: '/lab', label: 'Лаборатория' },
                { href: '/payments', label: 'Платежи' },
                { href: '/disputes', label: 'Споры' },
                { href: `/lots/${deal.lotId}`, label: `Лот ${deal.lotId}` },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="mini-chip">{l.label}</Link>
              ))}
            </div>
          </div>

          <NextStepBar
            title={deal.nextAction || 'Execution rail в процессе'}
            detail="Сделка движется по статусной машине. Каждый участник видит свои action items."
            primary={{ href: `/deals/${deal.id}/passport`, label: 'Паспорт сделки' }}
            secondary={[
              { href: '/logistics', label: 'Логистика' },
              { href: '/payments', label: 'Платежи' },
              { href: '/deals', label: '← Все сделки' },
            ]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
