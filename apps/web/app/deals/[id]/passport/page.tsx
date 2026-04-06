import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../../components/app-shell';
import { Breadcrumbs } from '../../../../components/breadcrumbs';
import { PageAccessGuard } from '../../../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../../../lib/route-roles';
import { apiServer } from '../../../../lib/api-server';

type Passport = {
  id: string; status: string; statusLabel: string;
  parties: { seller: { orgId: string }; buyer: { orgId: string } };
  metrics: { volumeTons: number; pricePerTon: number; totalRub: number; currency: string };
  dates: { createdAt: string; signedAt?: string | null; updatedAt?: string | null };
  lot: { id: string; culture: string; region: string };
};

const STATUS_RU: Record<string, string> = {
  DRAFT: 'Черновик', AWAITING_SIGN: 'Ожидает подписи', SIGNED: 'Подписана',
  PREPAYMENT_RESERVED: 'Предоплата резервирована', LOADING: 'Погрузка',
  IN_TRANSIT: 'В пути', ARRIVED: 'Прибыл', QUALITY_CHECK: 'Проверка качества',
  ACCEPTED: 'Принят', FINAL_PAYMENT: 'Финальный платёж', SETTLED: 'Расчёт завершён',
  CLOSED: 'Закрыт', DISPUTE_OPEN: 'Спор открыт',
};

const STATUS_COLOR: Record<string, string> = {
  IN_TRANSIT: 'amber', QUALITY_CHECK: 'amber', LOADING: 'amber',
  DISPUTE_OPEN: 'red', SETTLED: 'green', SIGNED: 'green', ACCEPTED: 'green',
  CLOSED: 'gray', DRAFT: 'gray',
};

const CULTURE_RU: Record<string, string> = { wheat: 'Пшеница', barley: 'Ячмень', corn: 'Кукуруза', sunflower: 'Подсолнечник' };

const SEED: Record<string, Passport> = {
  'DEAL-001': {
    id: 'DEAL-001', status: 'IN_TRANSIT', statusLabel: 'В пути',
    parties: { seller: { orgId: 'org-farmer-1' }, buyer: { orgId: 'org-buyer-1' } },
    metrics: { volumeTons: 500, pricePerTon: 12750, totalRub: 6375000, currency: 'RUB' },
    dates: { createdAt: '2026-03-22T10:00:00Z', signedAt: '2026-03-25T12:00:00Z', updatedAt: '2026-03-29T14:00:00Z' },
    lot: { id: 'LOT-001', culture: 'wheat', region: 'Тамбовская область' },
  },
  'DEAL-002': {
    id: 'DEAL-002', status: 'QUALITY_CHECK', statusLabel: 'Проверка качества',
    parties: { seller: { orgId: 'org-farmer-1' }, buyer: { orgId: 'org-buyer-2' } },
    metrics: { volumeTons: 750, pricePerTon: 11500, totalRub: 8625000, currency: 'RUB' },
    dates: { createdAt: '2026-03-18T10:00:00Z', signedAt: '2026-03-20T09:00:00Z', updatedAt: '2026-04-02T10:00:00Z' },
    lot: { id: 'LOT-003', culture: 'corn', region: 'Краснодарский край' },
  },
  'DEAL-003': {
    id: 'DEAL-003', status: 'SIGNED', statusLabel: 'Подписана',
    parties: { seller: { orgId: 'org-farmer-2' }, buyer: { orgId: 'org-buyer-1' } },
    metrics: { volumeTons: 300, pricePerTon: 11000, totalRub: 3300000, currency: 'RUB' },
    dates: { createdAt: '2026-04-01T10:00:00Z', signedAt: '2026-04-02T09:00:00Z' },
    lot: { id: 'LOT-002', culture: 'barley', region: 'Воронежская область' },
  },
};

async function load(id: string): Promise<Passport | null> {
  try {
    const res = await apiServer(`/deals/${id}/passport`);
    return res?.id ? res : SEED[id] ?? null;
  } catch {
    return SEED[id] ?? null;
  }
}

function Row({ label, value, chip }: { label: string; value: string | React.ReactNode; chip?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border, #e5e7eb)' }}>
      <div className="muted small">{label}</div>
      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
        {value}
        {chip && <span className="mini-chip">{chip}</span>}
      </div>
    </div>
  );
}

import type React from 'react';

export default async function DealPassportPage({ params }: { params: { id: string } }) {
  const passport = await load(params.id);
  if (!passport) notFound();

  const { metrics, parties, dates, lot } = passport;
  const cultureRu = CULTURE_RU[lot.culture] || lot.culture;

  const PASSPORT_SECTIONS = [
    {
      title: 'Коммерческий паспорт',
      icon: '₽',
      rows: [
        { label: 'ID сделки', value: passport.id },
        { label: 'Культура', value: cultureRu },
        { label: 'Регион', value: lot.region },
        { label: 'Лот', value: lot.id },
        { label: 'Объём', value: `${Number(metrics.volumeTons).toLocaleString('ru-RU')} т` },
        { label: 'Цена/т', value: `${Number(metrics.pricePerTon).toLocaleString('ru-RU')} ₽` },
        { label: 'Сумма сделки', value: `${Number(metrics.totalRub).toLocaleString('ru-RU')} ₽` },
        { label: 'Валюта', value: metrics.currency },
      ],
    },
    {
      title: 'Паспорт сторон',
      icon: '👥',
      rows: [
        { label: 'Продавец (FARMER)', value: parties.seller.orgId },
        { label: 'Покупатель (BUYER)', value: parties.buyer.orgId },
      ],
    },
    {
      title: 'Паспорт дат',
      icon: '📅',
      rows: [
        { label: 'Создана', value: new Date(dates.createdAt).toLocaleString('ru-RU') },
        { label: 'Подписана', value: dates.signedAt ? new Date(dates.signedAt).toLocaleString('ru-RU') : 'Не подписана' },
        { label: 'Обновлена', value: dates.updatedAt ? new Date(dates.updatedAt).toLocaleString('ru-RU') : '—' },
      ],
    },
    {
      title: 'Паспорт статуса',
      icon: '🔄',
      rows: [
        { label: 'Текущий статус', value: STATUS_RU[passport.status] || passport.status },
        { label: 'Статус label', value: passport.statusLabel || passport.status },
      ],
    },
  ];

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]}
      title="Доступ к паспорту сделки ограничен"
      subtitle="Паспорт доступен участникам сделки и операционным ролям.">
      <AppShell title={`Паспорт · ${passport.id}`} subtitle="Коммерческий, quality, transport, docs, money и dispute passports">
        <div className="space-y-6">
          <Breadcrumbs items={[
            { href: '/', label: 'Главная' },
            { href: '/deals', label: 'Сделки' },
            { href: `/deals/${passport.id}`, label: passport.id },
            { label: 'Паспорт' },
          ]} />

          {/* Status badge */}
          <div className="soft-box" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className={`mini-chip ${STATUS_COLOR[passport.status] || 'gray'}`}>
              {STATUS_RU[passport.status] || passport.status}
            </span>
            <span className="muted small">Паспорт сделки {passport.id}</span>
          </div>

          {/* Sections */}
          {PASSPORT_SECTIONS.map((section) => (
            <div key={section.title} className="soft-box">
              <div className="section-title" style={{ marginBottom: 12 }}>
                {section.icon} {section.title}
              </div>
              {section.rows.map((row) => (
                <Row key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          ))}

          {/* Placeholder passports */}
          {[
            { title: 'Качественный паспорт', icon: '🧪', link: '/lab', linkLabel: 'Лаборатория' },
            { title: 'Транспортный паспорт', icon: '🚚', link: '/logistics', linkLabel: 'Логистика' },
            { title: 'Документальный паспорт', icon: '📄', link: '/documents', linkLabel: 'Документы' },
            { title: 'Money паспорт', icon: '💳', link: '/payments', linkLabel: 'Платежи' },
            { title: 'Dispute паспорт', icon: '⚖️', link: '/disputes', linkLabel: 'Споры' },
          ].map((s) => (
            <div key={s.title} className="soft-box" style={{ opacity: 0.75 }}>
              <div className="section-title" style={{ marginBottom: 8 }}>{s.icon} {s.title}</div>
              <div className="muted small" style={{ marginBottom: 8 }}>Данные поступают из связанного модуля.</div>
              <Link href={s.link} className="mini-chip">{s.linkLabel} →</Link>
            </div>
          ))}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
            <Link href={`/deals/${passport.id}`} className="mini-chip">← Сделка {passport.id}</Link>
            <Link href={`/deals/${passport.id}/timeline`} className="mini-chip">Timeline</Link>
            <Link href="/deals" className="mini-chip">Все сделки</Link>
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
