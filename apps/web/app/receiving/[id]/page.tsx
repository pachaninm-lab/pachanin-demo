import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { LOGISTICS_ROLES, RECEIVING_ROLES, INTERNAL_ONLY_ROLES } from '../../../lib/route-roles';

const receivingMap: Record<string, any> = {
  'DEAL-001': {
    queueSlot: '08:00',
    vehicle: 'А123ВС',
    status: 'WEIGHING',
    linkedDealId: 'DEAL-001',
    linkedWeighbridgeId: 'WB-001',
    nextAction: 'Закрыть weight handoff и прикрепить документы приёмки',
    blockers: ['без финального веса receiving rail не должен идти в settlement / payments', 'дальше нужен переход в weighbridge / documents / deal rail']
  },
  'DEAL-002': {
    queueSlot: '09:00',
    vehicle: 'М456ОР',
    status: 'UNLOADING',
    linkedDealId: 'DEAL-002',
    linkedWeighbridgeId: 'WB-002',
    nextAction: 'Закрыть unload evidence и передать партию в inventory / docs',
    blockers: ['receiving rail не должен жить отдельно от unload evidence и document pack']
  }
};

export default function ReceivingDetailPage({ params }: { params: { id: string } }) {
  const item = receivingMap[params.id] || receivingMap['DEAL-001'];

  return (
    <PageAccessGuard allowedRoles={[...LOGISTICS_ROLES, ...RECEIVING_ROLES, ...INTERNAL_ONLY_ROLES]} title="Receiving detail ограничен" subtitle="Карточка приёмки нужна логистике, площадке и оператору как handoff rail.">
      <PageFrame title={`Receiving ${params.id}`} subtitle="Карточка приёмки: queue, weighbridge, result and next action." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/receiving', label: 'Receiving' }, { label: params.id }]} />}>
        <SourceNote source="embedded receiving detail" warning="Receiving rail нужен не как статус очереди. Он должен вести в weighbridge, documents, inventory и linked deal rail, где реально закрывается handoff партии." compact />

        <DetailHero
          kicker="Receiving rail"
          title={`${item.vehicle} · slot ${item.queueSlot}`}
          description={`${item.status} · deal ${item.linkedDealId}`}
          chips={[item.status, item.queueSlot, item.linkedWeighbridgeId]}
          nextStep={item.nextAction}
          owner="receiving / operator / site"
          blockers={item.blockers.join(' · ')}
          actions={[
            { href: '/receiving', label: 'Назад в receiving' },
            { href: `/weighbridge/${item.linkedWeighbridgeId}`, label: 'Открыть weight', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Параметры приёмки</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Vehicle</span><b>{item.vehicle}</b></div>
              <div className="list-row"><span>Queue slot</span><b>{item.queueSlot}</b></div>
              <div className="list-row"><span>Status</span><b>{item.status}</b></div>
              <div className="list-row"><span>Weighbridge</span><b>{item.linkedWeighbridgeId}</b></div>
              <div className="list-row"><span>Deal</span><b>{item.linkedDealId}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Следующие rails</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="soft-box">Weighbridge — weight truth и final net</div>
              <div className="soft-box">Documents — акты / билеты / evidence package</div>
              <div className="soft-box">Inventory — партия после unload handoff</div>
            </div>
          </div>
        </div>

        <ModuleHub
          title="Связанные rails"
          subtitle="После receiving detail пользователь должен уходить туда, где реально закрывается handoff партии."
          items={[
            { href: `/weighbridge/${item.linkedWeighbridgeId}`, label: 'Weighbridge', detail: 'Проверить final weight и proof по партии.', icon: '⚖', meta: item.linkedWeighbridgeId, tone: 'blue' },
            { href: '/documents', label: 'Documents', detail: 'Прикрепить акты и weight evidence в пакет.', icon: '⌁', meta: 'docs', tone: 'green' },
            { href: '/inventory', label: 'Inventory', detail: 'Проверить batch handoff после unload.', icon: '📦', meta: 'storage', tone: 'amber' },
            { href: `/deals/${item.linkedDealId}`, label: 'Deal rail', detail: 'Проверить linked deal и execution continuation.', icon: '≣', meta: item.linkedDealId, tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть rail, который закрывает receiving handoff"
          detail={item.nextAction}
          primary={{ href: `/weighbridge/${item.linkedWeighbridgeId}`, label: 'Открыть weighbridge' }}
          secondary={[{ href: '/documents', label: 'Documents' }, { href: '/inventory', label: 'Inventory' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
