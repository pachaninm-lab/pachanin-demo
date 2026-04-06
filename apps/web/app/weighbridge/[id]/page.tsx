import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { LOGISTICS_ROLES, RECEIVING_ROLES, INTERNAL_ONLY_ROLES } from '../../../lib/route-roles';
import { readCommercialWorkspace } from '../../../lib/commercial-workspace-store';

export default async function WeighbridgeDetailPage({ params }: { params: { id: string } }) {
  const state = await readCommercialWorkspace();
  const slot = (state?.queueSlots || []).find((item: any) => item.id === params.id) || null;
  const title = slot?.vehicle || `Весовая сессия ${params.id}`;
  const dealId = slot?.linkedDealId || null;

  return (
    <PageAccessGuard allowedRoles={[...LOGISTICS_ROLES, ...RECEIVING_ROLES, ...INTERNAL_ONLY_ROLES]} title="Весовой контур ограничен" subtitle="Экран весовой нужен логистике, приёмке и оператору как часть evidence / receiving rail.">
      <PageFrame title={title} subtitle="Карточка weighing session должна объяснять gross/tare/net и вести дальше в receiving / docs / deal rail." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/weighbridge', label: 'Весовая' }, { label: params.id }]} />}>
        <SourceNote source="commercial workspace / seeded queue slots" warning="Весовая сессия — это не цифра сама по себе. Она должна сразу жить внутри receiving, documents и доказательного контура сделки." compact />

        <DetailHero
          kicker="Weighbridge session"
          title={title}
          description={dealId ? `Сделка ${dealId} · weight evidence и handoff в приёмку.` : 'Весовой контур без привязки к сделке опасен: evidence должен садиться в deal rail.'}
          chips={[
            `gross ${slot ? '42 180 кг' : '—'}`,
            `tare ${slot ? '14 060 кг' : '—'}`,
            `net ${slot ? '28 120 кг' : '—'}`,
          ]}
          nextStep={dealId ? 'Передать весовой результат в receiving и document pack.' : 'Привязать весовую сессию к сделке и receiving rail.'}
          owner="приёмка / весовая / оператор"
          blockers={dealId ? 'нужно закрыть handoff в receiving и документы' : 'нет привязки к сделке'}
          actions={[
            { href: dealId ? `/receiving/${dealId}` : '/receiving', label: 'Открыть приёмку' },
            { href: '/documents', label: 'Документы', variant: 'secondary' },
            { href: dealId ? `/deals/${dealId}` : '/deals', label: 'Сделка', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Весовые параметры</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Gross</span><b>42 180 кг</b></div>
              <div className="list-row"><span>Tare</span><b>14 060 кг</b></div>
              <div className="list-row"><span>Net</span><b>28 120 кг</b></div>
              <div className="list-row"><span>Session id</span><b>{params.id}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Что делать дальше</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="soft-box">Закрыть handoff в receiving rail.</div>
              <div className="soft-box">Приложить весовой документ в document pack.</div>
              <div className="soft-box">Сверить расхождение с ожиданием по сделке.</div>
            </div>
          </div>
        </div>

        <ModuleHub
          title="Связанные контуры"
          subtitle="Весовая карточка не должна быть тупиком: из неё должен быть прямой вход в receiving, deal, documents и спор, если есть расхождение."
          items={[
            { href: dealId ? `/receiving/${dealId}` : '/receiving', label: 'Приёмка', detail: 'Передать результат веса в решение по партии.', icon: '◫', meta: 'receiving', tone: 'blue' },
            { href: '/documents', label: 'Документы', detail: 'Добавить весовой билет в пакет доказательств.', icon: '⌁', meta: 'docs', tone: 'green' },
            { href: dealId ? `/deals/${dealId}` : '/deals', label: 'Сделка', detail: 'Проверить owner и следующий blocker по связанному rail.', icon: '≣', meta: dealId || 'deal rail', tone: 'amber' },
            { href: '/disputes', label: 'Споры', detail: 'Если вес спорный, открыть dispute без ручного поиска.', icon: '!', meta: 'claim', tone: 'gray' },
          ]}
        />

        <NextStepBar
          title={dealId ? 'Передать весовой результат в receiving' : 'Привязать session к сделке'}
          detail={dealId ? `Весовая сессия должна жить внутри сделки ${dealId}.` : 'Без deal link весовой контур не даёт доказательную силу.'}
          primary={{ href: dealId ? `/receiving/${dealId}` : '/receiving', label: dealId ? 'Открыть receiving' : 'К приёмке' }}
          secondary={[{ href: '/weighbridge', label: 'Весовая' }, { href: '/documents', label: 'Документы' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
