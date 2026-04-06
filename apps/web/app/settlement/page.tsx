import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { ModuleHub } from '../../components/module-hub';
import { RuntimeSourceBanner } from '../../components/runtime-source-banner';
import { getRuntimeSnapshot } from '../../lib/runtime-server';
import { PageAccessGuard } from '../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../lib/route-roles';

export default async function SettlementHubPage() {
  const snapshot = await getRuntimeSnapshot();
  const payments = snapshot.payments.slice(0, 5);
  const held = snapshot.payments.filter((item) => String(item.status).includes('HOLD')).length;
  const partial = snapshot.payments.filter((item) => String(item.status).includes('PARTIAL')).length;

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]} title="Settlement hub доступен только рабочим ролям" subtitle="Экран нужен как вход в payout-контур: worksheet, hold, release, документы и причины блокировки.">
      <AppShell title="Settlement hub" subtitle="Логически завершённый денежный маршрут: от документа и качества до release без противоречий." actions={<Link href="/payments" className="primary-link">Открыть ledger</Link>}>
        <RuntimeSourceBanner snapshot={snapshot} />
        <section className="dashboard-grid-3">
          <Link href="/payments" className="dashboard-card">
            <div className="dashboard-card-title">Hold active</div>
            <div className="dashboard-card-value">{held}</div>
            <div className="dashboard-card-caption">Платежи с незакрытым основанием для выпуска.</div>
          </Link>
          <Link href="/payments" className="dashboard-card">
            <div className="dashboard-card-title">Partial release</div>
            <div className="dashboard-card-value">{partial}</div>
            <div className="dashboard-card-caption">Сценарии частичного расчёта после приёмки или спора.</div>
          </Link>
          <Link href="/documents" className="dashboard-card">
            <div className="dashboard-card-title">Основание для выплаты</div>
            <div className="dashboard-card-value">Docs</div>
            <div className="dashboard-card-caption">Подписи, протоколы, титул и worksheet должны быть согласованы.</div>
          </Link>
        </section>

        <ModuleHub
          title="Связанные контуры settlement"
          subtitle="Settlement не живёт отдельно: он связан с документами, качеством, batch и спором."
          items={[
            { href: '/payments', label: 'Ledger', detail: 'Канонический реестр платежей и callback timeline.', icon: '₽', tone: 'green' },
            { href: '/documents', label: 'Документы', detail: 'Акты, договоры, ЭДО и недостающие обязательные формы.', icon: '⌁', tone: 'amber' },
            { href: '/lab', label: 'Качество', detail: 'Price impact и финальный протокол как часть worksheet.', icon: '∴', tone: 'amber' },
            { href: '/inventory', label: 'Титул / batch', detail: 'Без green-title товар нельзя корректно закрыть в деньгах.', icon: '□', tone: 'blue' },
            { href: '/disputes', label: 'Спор', detail: 'Если расчёт оспорен, settlement обязан вести в dispute-hold.', icon: '!', tone: 'red' }
          ]}
        />

        <section className="section-card">
          <div className="panel-title-row">
            <div>
              <div className="dashboard-section-title">Кейсы settlement</div>
              <div className="dashboard-section-subtitle">Каждая строка должна приводить в конкретный платёж или его основание.</div>
            </div>
          </div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {payments.map((payment) => (
              <Link key={payment.id} href={`/settlement/${payment.id}`} className="list-row linkable">
                <div>
                  <b>{payment.id}</b>
                  <div className="muted small">{payment.dealId} · {payment.status}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div><b>{Number(payment.amount).toLocaleString('ru-RU')} ₽</b></div>
                  <div className="muted small">Открыть settlement</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </AppShell>
    </PageAccessGuard>
  );
}
