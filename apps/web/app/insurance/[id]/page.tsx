import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { FINANCE_ROLES, OPERATOR_ROLES, INTERNAL_ONLY_ROLES } from '../../../lib/route-roles';

const insuranceMap: Record<string, any> = {
  'INS-001': {
    provider: 'АгроСтрах',
    status: 'INCIDENT_REPORTED',
    coverage: 'route + cargo',
    linkedDealId: 'DEAL-001',
    linkedDispatchId: 'DSP-001',
    nextAction: 'Открыть claim path и проверить evidence package для страхового кейса',
    blockers: ['без route/photo evidence страховой rail не должен идти дальше', 'дальше нужен переход в disputes / documents / payments']
  },
  'INS-002': {
    provider: 'РискПокрытие',
    status: 'ACTIVE',
    coverage: 'storage + handling',
    linkedDealId: 'DEAL-002',
    linkedDispatchId: 'DSP-002',
    nextAction: 'Проверить coverage и handoff в receiving / claim path',
    blockers: ['страховой rail не должен жить отдельно от dispatch и receiving']
  }
};

export default function InsuranceDetailPage({ params }: { params: { id: string } }) {
  const item = insuranceMap[params.id] || insuranceMap['INS-001'];

  return (
    <PageAccessGuard allowedRoles={[...FINANCE_ROLES, ...OPERATOR_ROLES, ...INTERNAL_ONLY_ROLES]} title="Страховой контур ограничен" subtitle="Карточка страхового кейса нужна finance / operator / internal ролям как claim-ready rail.">
      <PageFrame title={`Insurance ${params.id}`} subtitle="Деталь страхового кейса: coverage, linked deal/dispatch and claim-ready next action." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/insurance', label: 'Страхование' }, { label: params.id }]} />}>
        <SourceNote source="embedded insurance detail" warning="Страховой кейс нужен не как справка. Он должен вести в disputes, documents, dispatch и payments rails, где реально решается убыток и release path." compact />

        <DetailHero
          kicker="Insurance rail"
          title={item.provider}
          description={`${item.status} · coverage ${item.coverage}`}
          chips={[item.status, item.coverage, item.linkedDealId]}
          nextStep={item.nextAction}
          owner="finance / operator / insurer"
          blockers={item.blockers.join(' · ')}
          actions={[
            { href: '/insurance', label: 'Назад в страхование' },
            { href: `/deals/${item.linkedDealId}`, label: 'Открыть сделку', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Параметры кейса</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Provider</span><b>{item.provider}</b></div>
              <div className="list-row"><span>Status</span><b>{item.status}</b></div>
              <div className="list-row"><span>Coverage</span><b>{item.coverage}</b></div>
              <div className="list-row"><span>Deal</span><b>{item.linkedDealId}</b></div>
              <div className="list-row"><span>Dispatch</span><b>{item.linkedDispatchId}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Следующие rails</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="soft-box">Disputes — claim and money impact</div>
              <div className="soft-box">Documents — evidence и страховой пакет</div>
              <div className="soft-box">Dispatch — route / incident truth</div>
            </div>
          </div>
        </div>

        <ModuleHub
          title="Связанные rails"
          subtitle="После insurance detail пользователь должен уходить туда, где реально подтверждается ущерб и money impact."
          items={[
            { href: '/disputes', label: 'Disputes', detail: 'Открыть claim rail и проверить financial impact.', icon: '!', meta: 'claim', tone: 'amber' },
            { href: '/documents', label: 'Documents', detail: 'Проверить evidence package для insurance case.', icon: '⌁', meta: 'docs', tone: 'green' },
            { href: '/dispatch', label: 'Dispatch', detail: 'Проверить route / incident truth по кейсу.', icon: '→', meta: item.linkedDispatchId, tone: 'blue' },
            { href: `/deals/${item.linkedDealId}`, label: 'Deal rail', detail: 'Проверить linked deal и execution continuation.', icon: '≣', meta: item.linkedDealId, tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть rail, который решает страховой кейс"
          detail={item.nextAction}
          primary={{ href: '/disputes', label: 'Открыть disputes' }}
          secondary={[{ href: '/documents', label: 'Documents' }, { href: '/dispatch', label: 'Dispatch' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
