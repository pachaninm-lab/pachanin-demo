import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { LOGISTICS_ROLES, EXECUTIVE_ROLES, INTERNAL_ONLY_ROLES } from '../../../lib/route-roles';
import { readCommercialWorkspace } from '../../../lib/commercial-workspace-store';

export default async function RailwayRouteDetailPage({ params }: { params: { id: string } }) {
  const state = await readCommercialWorkspace();
  const route = state.railwayRoutes.find((item) => item.id === params.id) || null;

  if (!route) {
    return (
      <PageFrame title="ЖД-маршрут не найден" subtitle="Карточка rail route отсутствует в текущем workspace.">
        <div className="section-card">
          <div className="section-title">Нет данных</div>
          <div className="muted" style={{ marginTop: 8 }}>Вернись в railway rail и открой актуальный маршрут.</div>
          <div className="cta-stack" style={{ marginTop: 16 }}>
            <Link href="/railway" className="primary-link">Railway rail</Link>
            <Link href="/dispatch" className="secondary-link">Dispatch</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageAccessGuard allowedRoles={[...LOGISTICS_ROLES, ...EXECUTIVE_ROLES, ...INTERNAL_ONLY_ROLES]} title="ЖД-карточка ограничена" subtitle="Карточка railway route нужна логистике, оператору и управляющим ролям.">
      <PageFrame title={route.id} subtitle={`${route.originStation} → ${route.destinationStation}`} breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/railway', label: 'Railway' }, { label: route.id }]} />}>
        <SourceNote source="commercial workspace / railway projection" warning="Карточка ЖД-маршрута — рабочий rail логистики: station plan, wagons, ETA и следующий dispatch/storage path." compact />
        <DetailHero
          kicker="Railway route"
          title={`${route.originStation} → ${route.destinationStation}`}
          description={`Вагоны: ${route.wagons} · ETA: ${route.etaDays} дн. · Статус: ${route.status}.`}
          chips={[route.operator, `${route.wagons} вагонов`, `${route.etaDays} дн.`, route.status]}
          nextStep={route.nextAction}
          owner="railway rail"
          blockers={route.watchouts.join(' · ')}
          actions={[
            { href: '/railway', label: 'Назад в railway' },
            { href: '/dispatch', label: 'Dispatch', variant: 'secondary' },
            { href: '/inventory', label: 'Inventory', variant: 'secondary' },
          ]}
        />
        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Параметры маршрута</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Оператор</span><b>{route.operator}</b></div>
              <div className="list-row"><span>Вагоны</span><b>{route.wagons}</b></div>
              <div className="list-row"><span>ETA</span><b>{route.etaDays} дн.</b></div>
              <div className="list-row"><span>Плечо</span><b>{route.distanceKm} км</b></div>
              <div className="list-row"><span>Linked deal</span><b>{route.linkedDealId || '—'}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Следующие rails</div>
            <div className="detail-meta" style={{ marginTop: 12 }}>
              {route.nextRails.map((item) => <span key={typeof item === 'string' ? item : (item as any).href} className="mini-chip">{typeof item === 'string' ? item : (item as any).label}</span>)}
            </div>
            <div className="muted small" style={{ marginTop: 16 }}>Railway rail должен вести в dispatch/inventory/documents, а не завершаться на карточке маршрута.</div>
          </div>
        </div>
        <ModuleHub
          title="Связанные rails маршрута"
          subtitle="ЖД-карточка должна вести в оперативные rails исполнения, а не быть отдельной логистической карточкой."
          items={[
            { href: '/dispatch', label: 'Dispatch', detail: 'Проверить handoff между ЖД-плечом и общим dispatch rail.', icon: '🧭', meta: route.status, tone: 'blue' },
            { href: '/inventory', label: 'Inventory', detail: 'Понять, куда партия перейдёт после прибытия.', icon: '📦', meta: route.linkedDealId || 'storage', tone: 'green' },
            { href: '/documents', label: 'Documents', detail: 'Сверить railway docs и evidence по маршруту.', icon: '⌁', meta: 'evidence', tone: 'amber' },
            route.linkedDealId ? { href: `/deals/${route.linkedDealId}`, label: 'Deal rail', detail: 'Открыть linked deal и проверить, как route влияет на execution.', icon: '≣', meta: route.linkedDealId, tone: 'gray' } : { href: '/deals', label: 'Deals', detail: 'Перейти в linked execution rail.', icon: '≣', meta: 'open', tone: 'gray' },
          ]}
        />
        <NextStepBar
          title="Перейти из railway rail в следующий operational rail"
          detail={route.nextAction}
          primary={{ href: '/dispatch', label: 'Открыть dispatch' }}
          secondary={[{ href: '/inventory', label: 'Inventory' }, { href: '/documents', label: 'Documents' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
