import Link from 'next/link';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';

const roles = [
  { id: 'farmer', label: 'Фермер', detail: 'Рынок, лоты, buyer decision и переход в сделку.' },
  { id: 'buyer', label: 'Покупатель', detail: 'Закупка, dispatch, quality и money rail.' },
  { id: 'logistician', label: 'Логистика', detail: 'Рейсы, ETA, handoff в receiving и weight.' },
  { id: 'driver', label: 'Водитель', detail: 'Mobile rail: assignment, route, evidence.' },
  { id: 'lab', label: 'Лаборатория', detail: 'Проба, quality truth, settlement/dispute handoff.' },
  { id: 'elevator', label: 'Площадка', detail: 'Слот, вес, unload, inventory handoff.' },
  { id: 'support_manager', label: 'Оператор', detail: 'Queues, blockers, disputes, overrides.' },
  { id: 'executive', label: 'Управление', detail: 'Контур риска, денег и готовности.' }
];

export default function RolesPage() {
  return (
    <PageFrame title="Роли" subtitle="Стартовые точки входа по ролевым rails платформы." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Роли' }]} />}>
      <SourceNote source="embedded role registry" warning="Страница ролей нужна не как справка, а как быстрый вход в рабочие rails каждой роли." compact />
      <DetailHero
        kicker="Role registry"
        title="Ролевые контуры платформы"
        description="Каждая роль должна вести дальше в свой рабочий rail, а не оставаться описанием обязанностей."
        chips={[`roles ${roles.length}`, 'entry rails', 'action-first']}
        nextStep="Открыть нужную роль и сразу перейти в её рабочий контур."
        owner="role routing"
        blockers="role guide не должен быть тупиком без перехода в рабочие модули"
        actions={[
          { href: '/cabinet', label: 'Кабинеты' },
          { href: '/control', label: 'Контроль', variant: 'secondary' },
          { href: '/operator-cockpit', label: 'Оператор', variant: 'secondary' }
        ]}
      />
      <section className="section-card-tight">
        <div className="dashboard-section-title">Роли</div>
        <div className="section-stack" style={{ marginTop: 16 }}>
          {roles.map((role) => (
            <Link key={role.id} href={`/roles/${role.id}`} className="list-row linkable">
              <div>
                <div style={{ fontWeight: 700 }}>{role.label}</div>
                <div className="muted small">{role.detail}</div>
              </div>
              <span className="mini-chip">Открыть</span>
            </Link>
          ))}
        </div>
      </section>
      <ModuleHub
        title="Связанные рабочие rails"
        subtitle="Из role registry пользователь должен уходить в реальную рабочую поверхность."
        items={[
          { href: '/cabinet', label: 'Кабинеты', detail: 'Ролевые рабочие поверхности по сегментам платформы.', icon: '⌘', meta: 'entry', tone: 'blue' },
          { href: '/control', label: 'Контроль', detail: 'Общий слой очередей, готовности и отклонений.', icon: '≣', meta: 'ops', tone: 'green' },
          { href: '/operator-cockpit', label: 'Operator cockpit', detail: 'Queue-driven центр оператора.', icon: '!', meta: 'queues', tone: 'amber' }
        ]}
      />
      <NextStepBar
        title="Открыть роль и перейти в рабочий rail"
        detail="Следующий шаг — не читать справку, а зайти в модуль, где роль реально работает."
        primary={{ href: '/roles/farmer', label: 'Открыть роль' }}
        secondary={[{ href: '/cabinet', label: 'Кабинеты' }, { href: '/control', label: 'Контроль' }]}
      />
    </PageFrame>
  );
}
