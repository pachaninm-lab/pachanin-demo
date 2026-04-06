import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../../lib/route-roles';

const providerMap: Record<string, any> = {
  'provider-log-1': {
    name: 'ТрансЛог Агро',
    category: 'LOGISTICS',
    status: 'RECOMMENDED',
    score: 91,
    reliability: 'green',
    nextAction: 'Назначить на dispatch rail и проверить GPS / ETA coverage',
    blockers: ['нужен linked dispatch assignment', 'после выбора обязателен handoff в route/receiving'],
    linkedHrefs: ['/dispatch', '/logistics', '/receiving']
  },
  'provider-lab-1': {
    name: 'АгроЛаб',
    category: 'LAB',
    status: 'RECOMMENDED',
    score: 88,
    reliability: 'green',
    nextAction: 'Назначить на quality rail и проверить settlement/dispute handoff',
    blockers: ['без финального protocol quality не должен уходить в settlement'],
    linkedHrefs: ['/lab', '/settlement', '/disputes']
  },
  'provider-bank-1': {
    name: 'Сбер',
    category: 'BANK',
    status: 'DEFAULT',
    score: 95,
    reliability: 'green',
    nextAction: 'Открыть money rail и проверить reserve / release path',
    blockers: ['без docs ready и owner action банк не должен выпускать деньги'],
    linkedHrefs: ['/payments', '/sber', '/documents']
  }
};

export default function ServiceProviderDetailPage({ params }: { params: { id: string } }) {
  const provider = providerMap[params.id] || {
    name: params.id,
    category: 'PROVIDER',
    status: 'MANUAL',
    score: 70,
    reliability: 'amber',
    nextAction: 'Проверить fit для этапа и открыть связанный rail',
    blockers: ['provider detail не должен жить отдельно от stage rail'],
    linkedHrefs: ['/service-providers', '/dispatch', '/payments']
  };

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]} title="Карточка исполнителя ограничена" subtitle="Деталь исполнителя доступна только рабочим ролям сделки и operator-контуру.">
      <PageFrame title={provider.name} subtitle={`${provider.category} · score ${provider.score}`} breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/service-providers', label: 'Исполнители' }, { label: provider.name }]} />}>
        <SourceNote source="embedded provider detail" warning="Карточка исполнителя нужна не как справочник. Она должна объяснять, почему этот provider рекомендован и в какой rail он ведёт дальше." compact />

        <DetailHero
          kicker="Provider detail"
          title={provider.name}
          description={`Категория ${provider.category} · статус ${provider.status} · reliability ${provider.reliability}.`}
          chips={[provider.category, provider.status, `score ${provider.score}`]}
          nextStep={provider.nextAction}
          owner="provider selection engine"
          blockers={provider.blockers.join(' · ')}
          actions={[
            { href: '/service-providers', label: 'Назад в реестр' },
            { href: provider.linkedHrefs[0], label: 'Открыть основной rail', variant: 'secondary' },
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Почему выбран</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Score</span><b>{provider.score}</b></div>
              <div className="list-row"><span>Status</span><b>{provider.status}</b></div>
              <div className="list-row"><span>Reliability</span><b>{provider.reliability}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Следующие rails</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              {provider.linkedHrefs.map((href: string) => <Link key={href} href={href} className="soft-box">{href}</Link>)}
            </div>
          </div>
        </div>

        <ModuleHub
          title="Связанные rails"
          subtitle="После выбора исполнителя пользователь должен уходить в stage rail, а не оставаться в карточке provider-а."
          items={provider.linkedHrefs.map((href: string, index: number) => ({ href, label: href.replace('/', '') || 'home', detail: 'Открыть связанный рабочий rail без ручного поиска.', icon: index === 0 ? '→' : index === 1 ? '⌁' : '≣', meta: provider.category, tone: index === 0 ? 'blue' : index === 1 ? 'green' : 'gray' }))}
        />

        <NextStepBar
          title="Перейти из карточки исполнителя в stage rail"
          detail={provider.nextAction}
          primary={{ href: provider.linkedHrefs[0], label: 'Открыть rail' }}
          secondary={provider.linkedHrefs.slice(1).map((href: string) => ({ href, label: href.replace('/', '') || 'home' }))}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
