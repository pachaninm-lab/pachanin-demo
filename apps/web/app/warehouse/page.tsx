import Link from 'next/link';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';
import { PageAccessGuard } from '../../components/page-access-guard';
import { LOGISTICS_ROLES, INTERNAL_ONLY_ROLES } from '../../lib/route-roles';
import { readCommercialWorkspace } from '../../lib/commercial-workspace-store';

export default async function WarehousePage() {
  const state = await readCommercialWorkspace();
  const slots = Array.isArray(state?.queueSlots) ? state.queueSlots : [];
  const warehouses = [
    { id: 'WH-001', title: 'Тамбовский узел', queue: slots.filter((item: any) => item.linkedDealId === 'DEAL-001').length, focus: 'receiving + docs' },
    { id: 'WH-002', title: 'Липецкий узел', queue: slots.filter((item: any) => item.linkedDealId === 'DEAL-002').length, focus: 'queue + unloading' },
  ];

  return (
    <PageAccessGuard allowedRoles={[...LOGISTICS_ROLES, ...INTERNAL_ONLY_ROLES]} title="Складской реестр ограничен" subtitle="Экран склада нужен логистике и оператору как рабочий queue / receiving rail.">
      <PageFrame title="Склады" subtitle="Реестр складских узлов: очередь, приёмка и связанный handoff в сделку и документы." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Склады' }]} />}>
        <SourceNote source="commercial workspace / seeded queue slots" warning="Складской список должен вести не в справочник, а в рабочие узлы склада, где видно queue pressure и следующий owner action." compact />

        <DetailHero
          kicker="Warehouse registry"
          title="Складские узлы исполнения"
          description="Каждый склад должен вести в receiving, dispatch и documents без ручного поиска по меню."
          chips={[`warehouses ${warehouses.length}`, `active slots ${slots.length}`, 'receiving rail']}
          nextStep="Открыть проблемный склад и снять queue / handoff blocker."
          owner="логистика / оператор"
          blockers={slots.length ? 'есть активные slots и handoff в receiving' : 'активных slots не видно'}
          actions={[
            { href: '/receiving', label: 'Приёмка' },
            { href: '/dispatch', label: 'Рейсы', variant: 'secondary' },
            { href: '/documents', label: 'Документы', variant: 'secondary' }
          ]}
        />

        <section className="section-card-tight">
          <div className="dashboard-section-title">Складские узлы</div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {warehouses.map((warehouse) => (
              <Link key={warehouse.id} href={`/warehouse/${warehouse.id}`} className="list-row linkable">
                <div>
                  <div style={{ fontWeight: 700 }}>{warehouse.title}</div>
                  <div className="muted small">{warehouse.id} · focus {warehouse.focus}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mini-chip">queue {warehouse.queue}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <ModuleHub
          title="Связанные контуры"
          subtitle="Из списка складов оператор должен уходить в receiving, dispatch, documents и сделки."
          items={[
            { href: '/receiving', label: 'Приёмка', detail: 'Решение по партии и handoff в документы.', icon: '◫', meta: 'receiving', tone: 'blue' },
            { href: '/dispatch', label: 'Рейсы', detail: 'Контроль ETA и машин до прибытия.', icon: '⇆', meta: 'dispatch', tone: 'amber' },
            { href: '/documents', label: 'Документы', detail: 'Весовые и акты не должны жить отдельно от склада.', icon: '⌁', meta: 'docs', tone: 'green' },
            { href: '/deals', label: 'Сделки', detail: 'Проверить owner и blocker по связанным поставкам.', icon: '≣', meta: 'deal rail', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть склад с queue pressure"
          detail="Следующий шаг — зайти в проблемный узел и провести handoff в receiving rail."
          primary={{ href: '/warehouse/WH-001', label: 'Открыть склад' }}
          secondary={[{ href: '/dispatch', label: 'Рейсы' }, { href: '/receiving', label: 'Приёмка' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
