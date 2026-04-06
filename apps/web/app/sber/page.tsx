import Link from 'next/link';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { PageAccessGuard } from '../../components/page-access-guard';
import { BANK_RAIL_ROLES } from '../../lib/route-roles';

export default function SberHubPage() {
  const items = [
    { href: '/payments', label: 'Платёжный контур', detail: 'Общий bank rail и сверки.' },
    { href: '/sber/beneficiaries/DEMO', label: 'Бенефициары', detail: 'Реестр и состояния бенефициаров.' },
    { href: '/sber/statements/DEMO', label: 'Выписка и bank truth', detail: 'Номинальный счёт, statement и reconciliation.' },
    { href: '/sber/events/DEMO', label: 'Bank events', detail: 'Журнал callback / money events / Safe Deals.' },
    { href: '/sber/refunds/DEMO', label: 'Возвраты', detail: 'Refund events и статус спорной части.' }
  ];
  return (
    <PageAccessGuard allowedRoles={[...BANK_RAIL_ROLES]} title="Sber cabinet ограничен" subtitle="Банковый контур доступен участникам сделки, finance и operator ролям.">
      <PageFrame title="Сбер · банковый контур" subtitle="Единый операционный слой для Safe Deals, кредита, statement и bank truth." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Сбер' }]} />}>
        <div className="mobile-two-grid">
          {items.map((item) => (
            <Link key={item.label} href={item.href} className="section-card-tight" style={{ display: 'block' }}>
              <div className="section-title">{item.label}</div>
              <div className="muted small" style={{ marginTop: 8 }}>{item.detail}</div>
            </Link>
          ))}
        </div>
        <div className="section-card-tight" style={{ marginTop: 16 }}>
          <div className="section-title">Навигация</div>
          <div className="muted small" style={{ marginTop: 8 }}>
            Для реальной работы открывай эти кабинеты из карточки конкретной сделки. DEMO ссылки на этом экране — только входные точки меню.
          </div>
        </div>
      </PageFrame>
    </PageAccessGuard>
  );
}
