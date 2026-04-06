import React from 'react';
import { api } from '../../lib/api-client';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { PageAccessGuard } from '../../components/page-access-guard';
import { BANK_RAIL_ROLES } from '../../lib/route-roles';
import { getRuntimeSnapshot } from '../../lib/runtime-server';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { OperationBlueprint } from '../../components/operation-blueprint';
import { ServiceProviderSelectionPanel } from '../../components/service-provider-selection-panel';
import { ServiceProviderAssignmentConsole } from '../../components/service-provider-assignment-console';
import { buildProviderStagePlan } from '../../../../packages/domain-core/src';
import { buildProviderContextFromWorkspace, describeProviderContext } from '../../lib/provider-stage-context';
import { readCommercialWorkspace, buildInsuranceView, buildSurveyView } from '../../lib/commercial-workspace-store';

export default async function PaymentsPage() {
  const [snapshot, workspace] = await Promise.all([getRuntimeSnapshot(), readCommercialWorkspace()]);
  const payments = snapshot.payments.slice(0, 5);
  const total = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const insuranceView = buildInsuranceView(workspace);
  const surveyView = buildSurveyView(workspace);
  const providerRiskBlocks = insuranceView.cases.filter((item) => ['INCIDENT_REPORTED', 'CLAIM_PREPARING', 'CLAIM_SUBMITTED'].includes(item.status)).length + surveyView.tasks.filter((item) => item.status === 'ATTACHED_TO_DISPUTE').length;
  const blocked = payments.filter((item) => String(item.status).includes('HOLD')).length + providerRiskBlocks;
  const paymentContext = buildProviderContextFromWorkspace('PAYMENT', workspace, { docsReady: snapshot.documents.length > 0, amountRub: total });
  const paymentPlan = buildProviderStagePlan('PAYMENT', paymentContext);
  const bankPolicy = paymentPlan.items.find((item) => item.category === 'BANK')!;
  return (
    <PageAccessGuard allowedRoles={[...BANK_RAIL_ROLES]} title="Платежи ограничены" subtitle="Раздел нужен только участникам сделки и операционным ролям.">
      <AppShell title="Кабинет бухгалтерии" subtitle="Финансы, сверки и документооборот.">
        <div className="page-surface">
          <section className="dashboard-grid-2">
            <Link href="/payments" className="dashboard-card"><div className="dashboard-card-title">К оплате</div><div className="dashboard-card-value">{Math.round(total).toLocaleString('ru-RU')} ₽</div><div className="dashboard-card-caption">Ожидают подтверждения банка</div></Link>
            <Link href="/documents" className="dashboard-card"><div className="dashboard-card-title">Неготовых документов</div><div className="dashboard-card-value">4</div><div className="dashboard-card-caption">ЭДО и закрывающие</div></Link>
          </section>

          <ServiceProviderSelectionPanel
            title="Банк по умолчанию — Сбер"
            subtitle={`В платформе банковый контур единый: ${describeProviderContext(paymentContext) || 'ready/not-ready контур'} . Сбер остаётся fixed rail без ручного выбора банка.`}
            selection={bankPolicy.selection}
            policy={bankPolicy}
            primaryHref="/service-providers"
            primaryLabel="Открыть банковый контур"
          />
          <ServiceProviderAssignmentConsole stage="PAYMENT" category="BANK" linkedObjectType="PAYMENT" linkedObjectId={payments[0]?.id || 'PAYMENT-PRESET'} linkedDealId={payments[0]?.dealId || null} context={paymentContext} policy={bankPolicy} />

          <div className="cta-stack" style={{ marginTop: 16 }}><Link href="/sber" className="secondary-link">Sber bank desks</Link></div>

          <ModuleHub title="Связанные функции финконтура" subtitle="Платежи должны быть связаны с документами, сделками, учётом и спорным хвостом." items={[
            { href: '/deals', label: 'Сделки', detail: 'Проверить owner action и checklist перед release.', icon: '≣', meta: `${snapshot.deals.length} сделок`, tone: 'blue' },
            { href: '/documents', label: 'Документы', detail: 'Полный пакет обязателен для оплаты.', icon: '⌁', meta: `${snapshot.documents.length} шт.`, tone: 'green' },
            { href: '/export-1c', label: '1С / экспорт', detail: 'Сверка и выгрузка проводок без ручных разрывов.', icon: '⇄', meta: 'учёт', tone: 'amber' },
            { href: '/disputes', label: 'Споры', detail: 'Hold и financial impact по претензиям, claim и сюрвею.', icon: '!', meta: `${blocked} hold`, tone: blocked ? 'red' : 'gray' }
          ] as any} />

          <OperationBlueprint
            title="Как должен заканчиваться платёжный контур"
            subtitle="Финансы не должны обрываться на сумме. Дальше обязательны документы, release/hold, учёт и спорный хвост."
            stages={[
              { title: 'Проверка сделки', detail: 'Открыть owner action и статус исполнения перед выпуском денег.', state: payments.length ? 'active' : 'pending', href: '/deals' },
              { title: 'Документарная готовность', detail: 'Платёж можно выпускать только после полного комплекта и финальности документов.', state: snapshot.documents.length ? 'active' : 'pending', href: '/documents' },
              { title: 'Release или hold', detail: 'Каждый кейс должен получить решение: выплата, удержание или перевод в спор.', state: blocked ? 'risk' : 'active', href: '/disputes' },
              { title: 'Учёт и сверка', detail: 'После money decision операция должна отражаться в учётном контуре.', state: 'pending', href: '/export-1c' }
            ]}
            outcomes={[
              { href: '/documents', label: 'Документы перед оплатой', detail: 'Проверить legal readiness и audit trail по сделке.', meta: 'pre-check' },
              { href: '/disputes', label: 'Спор / hold path', detail: 'Если есть риск или претензия, финконтур должен уйти в dispute.', meta: `${blocked} hold` },
              { href: '/export-1c', label: 'Учёт', detail: 'После release деньги должны сразу переходить в сверку и выгрузку.', meta: 'post-payment' }
            ]}
            rules={[
              'Платёж нельзя считать завершённым, если неясно, какие документы и owner action его разрешают.',
              'Любая блокировка должна объяснять следующий рабочий маршрут: спор, доукомплектование, повторное подтверждение.',
              'Финальная точка функции — release/hold плюс отражение в учёте, а не просто наличие строки в реестре.'
            ]}
          />

          <section className="dashboard-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
              <h2 className="dashboard-section-title" style={{ marginBottom: 0 }}>Ожидают оплаты</h2>
              <span className={`status-pill ${blocked ? 'red' : 'green'}`}>{blocked ? `${blocked} блок.` : 'под контролем'}</span>
            </div>
            <div className="dashboard-list" style={{ marginTop: 16 }}>
              {payments.map((item, index) => (
                <Link key={item.id} href={`/payments/${item.id}`} className="dashboard-list-card">
                  <div className="dashboard-list-main">
                    <div className="dashboard-list-icon">₽</div>
                    <div>
                      <div className="dashboard-list-title">{item.reason} · {item.dealId}</div>
                      <div className="dashboard-list-subtitle">{item.initiatedBy} → {item.approvedBy || 'Ожидает банк'}</div>
                    </div>
                  </div>
                  <div className="dashboard-list-meta">
                    <div className="dashboard-list-title" style={{ fontSize: '1rem' }}>{Math.round(item.amount).toLocaleString('ru-RU')} ₽</div>
                    <span className={`status-pill ${index === 2 ? 'red' : 'gray'}`}>{index === 2 ? 'Заблокировано' : 'Не готово'}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <NextStepBar
            title={payments[0] ? 'Открыть верхний платёж и закрыть money truth' : 'Финансовый реестр пуст'}
            detail={payments[0] ? `${payments[0].reason} · ${payments[0].dealId}` : 'Нет активных платежей.'}
            primary={{ href: payments[0] ? `/payments/${payments[0].id}` : '/deals', label: payments[0] ? 'Открыть платёж' : 'Открыть сделки' }}
            secondary={[{ href: '/documents', label: 'Документы' }, { href: '/disputes', label: 'Споры' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}


// Payment confirm action
function ConfirmPaymentButton({ paymentId, dealId, status, onConfirm }: { paymentId: string; dealId?: string; status: string; onConfirm: () => void }) {
  const [loading, setLoading] = React.useState(false);
  if (status === 'PAID' || status === 'paid') return null;
  
  const handle = async () => {
    setLoading(true);
    try {
      await api.post(`/settlement-engine/deal/${dealId || paymentId}/confirm`);
      onConfirm();
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };
  
  return (
    <button onClick={handle} disabled={loading}
      style={{ padding: '6px 14px', background: '#0A5C36', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
      {loading ? '...' : 'Подтвердить оплату'}
    </button>
  );
}
