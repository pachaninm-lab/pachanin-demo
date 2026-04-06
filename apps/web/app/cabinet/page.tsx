import Link from 'next/link';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';

const cards = [
  { href: '/roles/farmer', title: 'Фермер / Продавец', detail: 'Лоты, buyer offer, сделки, документы и расчёты.', icon: '🌾', tag: 'FARMER' },
  { href: '/roles/buyer', title: 'Покупатель', detail: 'Спрос, сделки, приёмка, quality и money rail.', icon: '🛒', tag: 'BUYER' },
  { href: '/roles/logistician', title: 'Логист', detail: 'Рейсы, ETA, очередь приёмки и весовая.', icon: '🚛', tag: 'LOGISTICIAN' },
  { href: '/roles/driver', title: 'Водитель', detail: 'Маршрут, GPS-события и handoff на элеватор.', icon: '🚚', tag: 'DRIVER' },
  { href: '/roles/lab', title: 'Лаборатория', detail: 'Проба, quality truth, settlement/dispute handoff.', icon: '🧪', tag: 'LAB' },
  { href: '/roles/elevator', title: 'Элеватор / Приёмка', detail: 'Слоты, весовая, выгрузка и хранение.', icon: '🏭', tag: 'ELEVATOR' },
  { href: '/roles/accounting', title: 'Бухгалтерия', detail: 'Платежи, финзаявки, банк и экспорт в 1С.', icon: '📊', tag: 'ACCOUNTING' },
  { href: '/roles/executive', title: 'Руководитель', detail: 'Аналитика, KPI, риски и репутация.', icon: '📈', tag: 'EXECUTIVE' },
  { href: '/roles/support_manager', title: 'Оператор', detail: 'Очереди, блокеры, споры, overrides.', icon: '⚙️', tag: 'SUPPORT_MANAGER' },
  { href: '/roles/admin', title: 'Администратор', detail: 'Компании, коннекторы, аудит и роли.', icon: '🔑', tag: 'ADMIN' },
];

export default function CabinetPage() {
  return (
    <PageFrame
      title="Кабинеты ролей"
      subtitle="Ролевые рабочие поверхности платформы — быстрый вход в операционный контур."
      breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Кабинеты' }]} />}
    >
      <SourceNote source="embedded cabinet registry" warning="Кабинет — это быстрый вход в рабочий rail роли. Выберите свою роль и перейдите в операционный контур." compact />
      <DetailHero
        kicker="Role cabinets"
        title="Выберите свою роль"
        description="Каждая роль имеет свой рабочий контур: от лотов и торгов до приёмки, качества, денег и аудита."
        chips={[`${cards.length} ролей`, 'entry rails', 'role-first']}
        nextStep="Откройте кабинет своей роли и перейдите в основной рабочий rail."
        owner="role routing"
        blockers=""
        actions={[
          { href: '/deals', label: 'Сделки' },
          { href: '/documents', label: 'Документы', variant: 'secondary' },
          { href: '/operator-cockpit', label: 'Operator cockpit', variant: 'secondary' },
        ]}
      />

      <section className="section-card-tight">
        <div className="dashboard-section-title">Кабинеты по ролям</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
          marginTop: 16,
        }}>
          {cards.map((card) => (
            <Link key={card.href} href={card.href} className="section-card-tight" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 24, lineHeight: 1 }}>{card.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{card.title}</div>
                  <div className="muted small" style={{ marginTop: 4 }}>{card.detail}</div>
                  <div style={{ marginTop: 8 }}>
                    <span className="mini-chip">{card.tag}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <NextStepBar
        title="Открыть кабинет своей роли"
        detail="Выберите роль и перейдите в операционный рабочий контур."
        primary={{ href: '/roles/farmer', label: 'Кабинет фермера' }}
        secondary={[
          { href: '/roles/buyer', label: 'Покупатель' },
          { href: '/roles/support_manager', label: 'Оператор' },
        ]}
      />
    </PageFrame>
  );
}
