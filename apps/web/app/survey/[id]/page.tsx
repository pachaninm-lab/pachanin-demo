import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { OPERATOR_ROLES, INTERNAL_ONLY_ROLES, TRADING_ROLES } from '../../../lib/route-roles';

const surveyMap: Record<string, any> = {
  'SV-001': {
    provider: 'АгроИнспект',
    status: 'ASSIGNED',
    type: 'QUALITY',
    linkedDealId: 'DEAL-001',
    linkedDisputeId: 'DIS-001',
    nextAction: 'Подтвердить sample / report path и прикрепить результат к dispute-ready rail',
    blockers: ['без report attachment survey rail не должен влиять на dispute / settlement', 'дальше нужен переход в lab / disputes / documents']
  },
  'SV-002': {
    provider: 'Field Survey Ops',
    status: 'ATTACHED_TO_DISPUTE',
    type: 'INSPECTION',
    linkedDealId: 'DEAL-002',
    linkedDisputeId: 'DIS-002',
    nextAction: 'Открыть dispute rail и проверить financial impact survey report',
    blockers: ['survey rail не должен жить отдельно от claim / quality truth']
  }
};

export default function SurveyDetailPage({ params }: { params: { id: string } }) {
  const item = surveyMap[params.id] || surveyMap['SV-001'];

  return (
    <PageAccessGuard allowedRoles={[...OPERATOR_ROLES, ...INTERNAL_ONLY_ROLES, ...TRADING_ROLES]} title="Survey detail ограничен" subtitle="Карточка survey нужна operator / trading / internal ролям как inspection rail.">
      <PageFrame title={`Survey ${params.id}`} subtitle="Деталь инспекции: sample/report path, dispute readiness and linked quality rails." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/survey', label: 'Сюрвей' }, { label: params.id }]} />}>
        <SourceNote source="embedded survey detail" warning="Survey rail нужен не как назначение исполнителя. Он должен вести в lab, documents и disputes, где реально появляется quality truth и money impact." compact />

        <DetailHero
          kicker="Survey rail"
          title={item.provider}
          description={`${item.type} · ${item.status}`}
          chips={[item.type, item.status, item.linkedDealId]}
          nextStep={item.nextAction}
          owner="operator / survey provider"
          blockers={item.blockers.join(' · ')}
          actions={[
            { href: '/survey', label: 'Назад в survey' },
            { href: '/disputes', label: 'Открыть disputes', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Параметры кейса</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Provider</span><b>{item.provider}</b></div>
              <div className="list-row"><span>Type</span><b>{item.type}</b></div>
              <div className="list-row"><span>Status</span><b>{item.status}</b></div>
              <div className="list-row"><span>Deal</span><b>{item.linkedDealId}</b></div>
              <div className="list-row"><span>Dispute</span><b>{item.linkedDisputeId}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Следующие rails</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="soft-box">Lab — quality truth и report attachment</div>
              <div className="soft-box">Disputes — claim path и financial impact</div>
              <div className="soft-box">Documents — evidence package и final proof</div>
            </div>
          </div>
        </div>

        <ModuleHub
          title="Связанные rails"
          subtitle="После survey detail пользователь должен уходить туда, где inspection report реально начинает работать."
          items={[
            { href: '/lab', label: 'Lab', detail: 'Проверить quality truth и report status.', icon: '∴', meta: 'quality', tone: 'green' },
            { href: '/disputes', label: 'Disputes', detail: 'Открыть claim rail и проверить money impact.', icon: '!', meta: item.linkedDisputeId, tone: 'amber' },
            { href: '/documents', label: 'Documents', detail: 'Прикрепить report в evidence package.', icon: '⌁', meta: 'docs', tone: 'blue' },
            { href: `/deals/${item.linkedDealId}`, label: 'Deal rail', detail: 'Проверить linked deal и execution continuation.', icon: '≣', meta: item.linkedDealId, tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть rail, где survey реально влияет на решение"
          detail={item.nextAction}
          primary={{ href: '/disputes', label: 'Открыть disputes' }}
          secondary={[{ href: '/lab', label: 'Lab' }, { href: '/documents', label: 'Documents' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
