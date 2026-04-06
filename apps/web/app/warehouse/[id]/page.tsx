import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { LOGISTICS_ROLES, INTERNAL_ONLY_ROLES } from '../../../lib/route-roles';
import { readCommercialWorkspace } from '../../../lib/commercial-workspace-store';

export default async function WarehouseDetailPage({ params }: { params: { id: string } }) {
  const state = await readCommercialWorkspace();
  const queue = Array.isArray(state?.queueSlots) ? state.queueSlots : [];
  const related = queue.filter((item: any) => String(item.linkedDealId || '').trim()).slice(0, 4);
  const warehouseId = params.id;
  const queuePressure = related.length >= 3 ? 'high' : related.length >= 1 ? 'medium' : 'low';

  return (
    <PageAccessGuard allowedRoles={[...LOGISTICS_ROLES, ...INTERNAL_ONLY_ROLES]} title="Складской узел ограничен" subtitle="Экран склада нужен логистике, оператору и internal-ролям как рабочий queue / receiving rail.">
      <PageFrame title={`Склад · ${warehouseId}`} subtitle="Карточка склада должна собирать очередь, приёмку и связанные сделки в одном месте." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/warehouse', label: 'Склады' }, { label: warehouseId }]} />}>
        <SourceNote source="commercial workspace / seeded queue slots" warning="Складской экран не должен быть справочником. Он нужен как рабочая точка для queue, receiving и следующего действия по связанным сделкам." compact />

        <DetailHero
          kicker="Warehouse workspace"
          title={warehouseId}
          description="Складской узел связывает очередь машин, приёмку, простои и handoff в document / payment rail."
          chips={[`queue ${queuePressure}`, `slots ${related.length}`, 'receiving rail']}
          nextStep={related.length ? 'Открыть ближайшую связанную сделку и снять очередь/приёмку.' : 'Подготовить склад к следующей поставке.'}
          owner="логистика / оператор"
          blockers={related.length ? 'очередь и handoff требуют контроля' : 'критичных блокеров не видно'}
          actions={[
            { href: '/receiving', label: 'Приёмка' },
            { href: '/dispatch', label: 'Рейсы', variant: 'secondary' },
            { href: '/documents', label: 'Документы', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Операционный профиль</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Queue pressure</span><b>{queuePressure}</b></div>
              <div className="list-row"><span>Активные slots</span><b>{related.length}</b></div>
              <div className="list-row"><span>Receiving lane</span><b>{related.length ? 'active' : 'standby'}</b></div>
              <div className="list-row"><span>Document handoff</span><b>{related.length ? 'required' : 'idle'}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Следующие действия</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              {related.length ? related.map((slot: any) => (
                <Link key={slot.id} href={slot.linkedDealId ? `/receiving/${slot.linkedDealId}` : '/receiving'} className="list-row linkable">
                  <div>
                    <div style={{ fontWeight: 700 }}>{slot.vehicle || 'Машина'}</div>
                    <div className="muted small">slot {slot.slot} · ETA {slot.etaLabel || '—'}</div>
                  </div>
                  <span className="mini-chip">{slot.status || 'ACTIVE'}</span>
                </Link>
              )) : <div className="muted small">Активных складских slots пока нет.</div>}
            </div>
          </div>
        </div>

        <ModuleHub
          title="Связанные модули склада"
          subtitle="Из warehouse-узла оператор должен уходить в receiving, dispatch, documents и сделку, а не блуждать по меню."
          items={[
            { href: '/receiving', label: 'Приёмка', detail: 'Решение по партии, весу и handoff в документы.', icon: '◫', meta: 'receiving', tone: 'blue' },
            { href: '/dispatch', label: 'Рейсы', detail: 'Контроль ETA и машины до прибытия на склад.', icon: '⇆', meta: 'dispatch', tone: 'amber' },
            { href: '/documents', label: 'Документы', detail: 'Весовые и акты не должны жить отдельно от склада.', icon: '⌁', meta: 'docs', tone: 'green' },
            { href: '/deals', label: 'Сделки', detail: 'Проверить owner и следующий blocker по связанным поставкам.', icon: '≣', meta: 'deal rail', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title={related.length ? 'Открыть ближайшую связанную приёмку' : 'Вернуться в общую складскую очередь'}
          detail={related.length ? 'Очередь и receiving — главный следующий шаг для этого склада.' : 'Когда связанный rail появится, этот экран должен вести в него напрямую.'}
          primary={{ href: related[0]?.linkedDealId ? `/receiving/${related[0].linkedDealId}` : '/receiving', label: related.length ? 'Открыть приёмку' : 'Открыть receiving' }}
          secondary={[{ href: '/warehouse', label: 'Склады' }, { href: '/dispatch', label: 'Рейсы' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
