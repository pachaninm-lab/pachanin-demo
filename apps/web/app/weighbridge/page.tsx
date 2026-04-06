import Link from 'next/link';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';
import { PageAccessGuard } from '../../components/page-access-guard';
import { LOGISTICS_ROLES, RECEIVING_ROLES, INTERNAL_ONLY_ROLES } from '../../lib/route-roles';
import { readCommercialWorkspace } from '../../lib/commercial-workspace-store';

export default async function WeighbridgePage() {
  const state = await readCommercialWorkspace();
  const slots = Array.isArray(state?.queueSlots) ? state.queueSlots : [];
  const sessions = [
    { id: 'WB-001', vehicle: 'А123ВС', status: 'GROSS_DONE', linkedDealId: 'DEAL-001', grossKg: 42180, tareKg: 14060, netKg: 28120 },
    { id: 'WB-002', vehicle: 'М456ОР', status: 'UNLOADING', linkedDealId: 'DEAL-002', grossKg: 39840, tareKg: 13620, netKg: 26220 },
  ];

  return (
    <PageAccessGuard allowedRoles={[...LOGISTICS_ROLES, ...RECEIVING_ROLES, ...INTERNAL_ONLY_ROLES]} title="Реестр весовых ограничен" subtitle="Весовой контур нужен логистике, приёмке и оператору как часть evidence / receiving rail.">
      <PageFrame title="Весовая" subtitle="Реестр весовых сессий: gross/tare/net, handoff в receiving и связанный deal rail." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Весовая' }]} />}>
        <SourceNote source="seeded weighbridge registry" warning="Весовой список нужен не для просмотра цифр, а для решения: куда должен уйти результат веса дальше — в receiving, documents или dispute rail." compact />

        <DetailHero
          kicker="Weighbridge registry"
          title="Весовые сессии исполнения"
          description="Каждая сессия должна вести в receiving, documents и сделку без ручного поиска."
          chips={[`sessions ${sessions.length}`, `queue slots ${slots.length}`, 'evidence rail']}
          nextStep="Открыть спорную или активную сессию и довести handoff в receiving."
          owner="приёмка / логистика / оператор"
          blockers="весовые данные должны быть встроены в receiving и документарный пакет"
          actions={[
            { href: '/receiving', label: 'Приёмка' },
            { href: '/documents', label: 'Документы', variant: 'secondary' },
            { href: '/disputes', label: 'Споры', variant: 'secondary' }
          ]}
        />

        <section className="section-card-tight">
          <div className="dashboard-section-title">Весовые сессии</div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {sessions.map((session) => (
              <Link key={session.id} href={`/weighbridge/${session.id}`} className="list-row linkable">
                <div>
                  <div style={{ fontWeight: 700 }}>{session.vehicle}</div>
                  <div className="muted small">{session.id} · net {session.netKg.toLocaleString('ru-RU')} кг · deal {session.linkedDealId}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mini-chip">{session.status}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <ModuleHub
          title="Связанные контуры"
          subtitle="Из списка весовых оператор должен уходить в receiving, deal, documents и dispute."
          items={[
            { href: '/receiving', label: 'Приёмка', detail: 'Передать вес в решение по партии.', icon: '◫', meta: 'receiving', tone: 'blue' },
            { href: '/documents', label: 'Документы', detail: 'Весовой билет должен входить в пакет доказательств.', icon: '⌁', meta: 'docs', tone: 'green' },
            { href: '/deals', label: 'Сделки', detail: 'Проверить owner и blocker по связанному rail.', icon: '≣', meta: 'deal rail', tone: 'amber' },
            { href: '/disputes', label: 'Споры', detail: 'Если есть расхождение по весу, открыть claim без ручного поиска.', icon: '!', meta: 'claim', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть активную весовую сессию"
          detail="Следующий шаг — перевести результат веса в receiving и document rail."
          primary={{ href: '/weighbridge/WB-001', label: 'Открыть сессию' }}
          secondary={[{ href: '/receiving', label: 'Приёмка' }, { href: '/documents', label: 'Документы' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
