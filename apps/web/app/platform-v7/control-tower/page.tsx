'use client';
import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowRight, Clock, FileWarning,
  TrendingUp, Banknote, FileCheck, ShieldAlert,
} from 'lucide-react';
import { KpiCard } from '@/components/v9/cards/KpiCard';
import { EmptyState } from '@/components/v9/cards/EmptyState';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { Skeleton } from '@/components/v9/ui/skeleton';
import { useSessionStore } from '@/stores/useSessionStore';
import type { DealStatus } from '@/lib/v9/statuses';

interface Deal {
  id: string;
  status: DealStatus;
  grain: string;
  quantity: number;
  unit: string;
  seller: { name: string };
  buyer: { name: string };
  holdAmount: number;
  reservedAmount: number;
  riskScore: number;
  blockers: string[];
  dispute: { id: string; title: string } | null;
  slaDeadline: string | null;
  updatedAt: string;
}

const statusLabel: Partial<Record<DealStatus, string>> = {
  draft: 'Черновик',
  contract_signed: 'Контракт',
  payment_reserved: 'Резерв',
  loading_scheduled: 'Погрузка',
  loading_started: 'Погрузка',
  loading_done: 'Погружено',
  in_transit: 'В пути',
  arrived: 'Прибыл',
  unloading_started: 'Разгрузка',
  unloading_done: 'Разгружено',
  quality_check: 'Проверка кач.',
  quality_approved: 'Одобрено',
  quality_disputed: 'Спор',
  docs_complete: 'Документы',
  release_requested: 'Запрос release',
  release_approved: 'Release одобрен',
  closed: 'Закрыта',
};

function getRiskTone(score: number): 'danger' | 'warning' | 'success' {
  if (score >= 70) return 'danger';
  if (score >= 30) return 'warning';
  return 'success';
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} тыс. ₽`;
  return `${n} ₽`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function slaDaysLeft(deadline: string): number {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000));
}

export default function ControlTowerPage() {
  const demoMode = useSessionStore(s => s.demoMode);

  const { data, isLoading, isError, refetch } = useQuery<{ data: Deal[] }>({
    queryKey: ['deals'],
    queryFn: () => fetch('/api/deals').then(r => r.json()),
  });

  const deals = data?.data ?? [];

  // KPI aggregates
  const totalReserved = deals.reduce((s, d) => s + d.reservedAmount, 0);
  const totalHold = deals.reduce((s, d) => s + d.holdAmount, 0);
  const activeDeals = deals.filter(d => d.status !== 'closed').length;
  const disputedDeals = deals.filter(d => d.status === 'quality_disputed').length;
  const highRisk = deals.filter(d => d.riskScore >= 70);
  const topRisk = [...highRisk].sort((a, b) => b.riskScore - a.riskScore)[0];

  const docsOk = deals.filter(d => d.blockers.length === 0).length;
  const docsPct = deals.length ? Math.round((docsOk / deals.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', lineHeight: 1.2, margin: 0 }}>
            Control Tower
          </h1>
          <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>
            Обзор всех активных сделок · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {demoMode && (
            <span className="v9-badge v9-badge-warning">
              SANDBOX — данные демонстрационные
            </span>
          )}
          <Button
            variant="primary"
            size="md"
            asChild
          >
            <Link href="/platform-v9/deals">Все сделки →</Link>
          </Button>
        </div>
      </div>

      {/* Max-risk alert */}
      {!isLoading && topRisk && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            background: 'rgba(220,38,38,0.05)',
            border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: 8,
          }}
        >
          <AlertTriangle size={18} color="#DC2626" aria-hidden />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>
              Наивысший риск:
            </span>{' '}
            <span style={{ fontSize: 13, color: '#0F1419' }}>
              {topRisk.id} · {topRisk.grain} · Risk score {topRisk.riskScore}
            </span>
            {topRisk.dispute && (
              <span style={{ fontSize: 12, color: '#DC2626', marginLeft: 8 }}>
                · Спор {topRisk.dispute.id}
              </span>
            )}
          </div>
          <Button variant="danger" size="sm" asChild>
            <Link href={`/platform-v9/deals/${topRisk.id}`}>Открыть <ArrowRight size={12} /></Link>
          </Button>
        </div>
      )}

      {/* KPI bento */}
      <div className="v9-bento">
        <KpiCard
          title="Деньги под контролем"
          value={isLoading ? '—' : formatMoney(totalReserved)}
          sub="Общий резерв по активным сделкам"
          tone="neutral"
          loading={isLoading}
          data-testid="kpi-reserved"
        />
        <KpiCard
          title="Риск под hold"
          value={isLoading ? '—' : formatMoney(totalHold)}
          sub={totalHold > 0 ? `${disputedDeals} спорных сделок` : 'Споров нет'}
          tone={totalHold > 0 ? 'danger' : 'success'}
          loading={isLoading}
          data-testid="kpi-hold"
        />
        <KpiCard
          title="Документов готово"
          value={isLoading ? '—' : `${docsPct}%`}
          sub={`${docsOk} из ${deals.length} сделок без блокеров`}
          tone={docsPct >= 80 ? 'success' : docsPct >= 50 ? 'warning' : 'danger'}
          progress={isLoading ? undefined : docsPct}
          loading={isLoading}
          data-testid="kpi-docs"
        />
        <KpiCard
          title="Активных сделок"
          value={isLoading ? '—' : String(activeDeals)}
          sub={`${highRisk.length} с высоким риском`}
          tone={highRisk.length > 0 ? 'warning' : 'neutral'}
          loading={isLoading}
          data-testid="kpi-deals"
        />
      </div>

      {/* Deals table */}
      <section aria-label="Список сделок">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', margin: 0 }}>
            Все сделки
          </h2>
          <span style={{ fontSize: 12, color: '#6B778C' }}>
            {isLoading ? '—' : `${deals.length} всего`}
          </span>
        </div>

        {isError && (
          <div
            role="alert"
            style={{
              padding: '16px', background: 'rgba(220,38,38,0.05)',
              border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            <FileWarning size={18} color="#DC2626" aria-hidden />
            <span style={{ fontSize: 13, color: '#DC2626' }}>
              Не удалось загрузить сделки.
            </span>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              Повторить
            </Button>
          </div>
        )}

        {!isError && (
          <div className="v9-table-wrap">
            <table className="v9-table v9-table-mobile-cards" aria-label="Таблица сделок">
              <thead>
                <tr>
                  <th scope="col">ID сделки</th>
                  <th scope="col">Культура</th>
                  <th scope="col">Стороны</th>
                  <th scope="col">Статус</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Резерв</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Удержание</th>
                  <th scope="col">Риск-балл</th>
                  <th scope="col">SLA</th>
                  <th scope="col"><span className="sr-only">Действия</span></th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} aria-hidden="true">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j}><Skeleton className="h-3.5 w-full" /></td>
                      ))}
                    </tr>
                  ))
                  : deals.length === 0
                    ? (
                      <tr>
                        <td colSpan={9}>
                          <EmptyState
                            icon={<TrendingUp />}
                            title="Сделок нет"
                            description="Создайте первую сделку, чтобы начать работу"
                            action={<Button variant="primary" size="sm">Создать сделку</Button>}
                          />
                        </td>
                      </tr>
                    )
                    : deals.map(deal => {
                      const riskTone = getRiskTone(deal.riskScore);
                      const hasDispute = deal.status === 'quality_disputed';
                      const riskLabel = riskTone === 'danger' ? 'Высокий' : riskTone === 'warning' ? 'Средний' : 'Низкий';

                      return (
                        <tr
                          key={deal.id}
                          onClick={() => { window.location.href = `/platform-v9/deals/${deal.id}`; }}
                          style={{ cursor: 'pointer' }}
                          aria-label={`Сделка ${deal.id}: ${deal.grain}`}
                        >
                          <td data-label="ID сделки">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 700, color: '#0F1419' }}>
                                {deal.id}
                              </span>
                              {hasDispute && <AlertTriangle size={12} color="#DC2626" aria-label="Активный спор" />}
                            </div>
                          </td>
                          <td data-label="Культура">
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{deal.grain}</div>
                            <div style={{ fontSize: 11, color: '#6B778C' }}>{deal.quantity} {deal.unit}</div>
                          </td>
                          <td data-label="Стороны">
                            <div style={{ fontSize: 12 }}>
                              <span style={{ color: '#495057' }}>{deal.seller.name}</span>
                              <span style={{ color: '#6B778C' }}> → {deal.buyer.name}</span>
                            </div>
                          </td>
                          <td data-label="Статус">
                            <Badge
                              variant={
                                deal.status === 'closed' ? 'success'
                                : deal.status === 'quality_disputed' ? 'danger'
                                : deal.status === 'release_approved' || deal.status === 'release_requested' ? 'info'
                                : deal.status === 'in_transit' ? 'brand'
                                : 'neutral'
                              }
                              dot
                            >
                              {statusLabel[deal.status] ?? deal.status}
                            </Badge>
                          </td>
                          <td data-label="Резерв" style={{ textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600 }}>
                            {deal.reservedAmount > 0 ? formatMoney(deal.reservedAmount) : '—'}
                          </td>
                          <td data-label="Удержание" style={{ textAlign: 'right' }}>
                            {deal.holdAmount > 0 ? (
                              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 700, color: '#DC2626' }}>
                                {formatMoney(deal.holdAmount)}
                              </span>
                            ) : (
                              <span style={{ color: '#6B778C', fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td data-label="Риск-балл">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div
                                style={{ width: 8, height: 8, borderRadius: '50%', background: riskTone === 'danger' ? '#DC2626' : riskTone === 'warning' ? '#D97706' : '#16A34A', flexShrink: 0 }}
                                aria-hidden
                              />
                              <span style={{ fontSize: 12, fontWeight: 600, color: riskTone === 'danger' ? '#DC2626' : riskTone === 'warning' ? '#D97706' : '#16A34A' }}>
                                {deal.riskScore}
                              </span>
                              <span className="sr-only">{riskLabel}</span>
                            </div>
                          </td>
                          <td data-label="SLA">
                            {deal.slaDeadline ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} color="#6B778C" aria-hidden />
                                <span style={{ fontSize: 12, color: slaDaysLeft(deal.slaDeadline) <= 3 ? '#DC2626' : '#6B778C' }}>
                                  {slaDaysLeft(deal.slaDeadline)} д
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: '#6B778C' }}>—</span>
                            )}
                          </td>
                          <td className="v9-td-no-label">
                            <Link
                              href={`/platform-v9/deals/${deal.id}`}
                              style={{ color: '#0A7A5F', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                              onClick={e => e.stopPropagation()}
                              aria-label={`Открыть сделку ${deal.id}`}
                            >
                              Открыть →
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quick actions for high-risk deals */}
      {!isLoading && highRisk.length > 0 && (
        <section aria-label="Требуют внимания" style={{ marginTop: 4 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginBottom: 12 }}>
            Требуют внимания
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {highRisk.map(deal => (
              <Link
                key={deal.id}
                href={`/platform-v9/deals/${deal.id}`}
                style={{
                  textDecoration: 'none',
                  display: 'block',
                  padding: '14px 16px',
                  background: '#fff',
                  border: '1px solid rgba(220,38,38,0.2)',
                  borderLeft: '4px solid #DC2626',
                  borderRadius: 8,
                  boxShadow: '0 1px 4px rgba(9,30,66,0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 700, color: '#0F1419' }}>
                    {deal.id}
                  </span>
                  <Badge variant="danger">Risk {deal.riskScore}</Badge>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F1419', marginTop: 6 }}>
                  {deal.grain} · {deal.quantity} {deal.unit}
                </div>
                <div style={{ fontSize: 12, color: '#6B778C', marginTop: 2 }}>
                  {deal.seller.name} → {deal.buyer.name}
                </div>
                {deal.dispute && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <ShieldAlert size={12} color="#DC2626" aria-hidden />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#DC2626' }}>
                      Спор {deal.dispute.id}
                    </span>
                  </div>
                )}
                {deal.holdAmount > 0 && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', marginTop: 4 }}>
                    Hold: {formatMoney(deal.holdAmount)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
