import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { EXECUTIVE_ROLES, INTERNAL_ONLY_ROLES } from '../../../lib/route-roles';
import { readCommercialWorkspace } from '../../../lib/commercial-workspace-store';

export default async function AntiFraudCaseDetailPage({ params }: { params: { id: string } }) {
  const state = await readCommercialWorkspace();
  const suspect = state.suspicions.find((item) => item.id === params.id) || null;

  if (!suspect) {
    return (
      <PageFrame title="Сигнал не найден" subtitle="Карточка anti-fraud сигнала отсутствует в текущем workspace.">
        <div className="section-card">
          <div className="section-title">Нет данных</div>
          <div className="muted" style={{ marginTop: 8 }}>Вернись в anti-fraud rail и открой актуальный сигнал.</div>
          <div className="cta-stack" style={{ marginTop: 16 }}>
            <Link href="/anti-fraud" className="primary-link">Anti-fraud rail</Link>
            <Link href="/companies" className="secondary-link">Компании</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageAccessGuard allowedRoles={[...EXECUTIVE_ROLES, ...INTERNAL_ONLY_ROLES]} title="Карточка сигнала ограничена" subtitle="Карточка anti-fraud сигнала нужна внутренним и контрольным ролям.">
      <PageFrame title={suspect.id} subtitle={`${suspect.score}/100 · ${suspect.summary}`} breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/anti-fraud', label: 'Anti-fraud' }, { label: suspect.id }]} />}>
        <SourceNote source="commercial workspace / anti-fraud projection" warning="Карточка сигнала — рабочий anti-fraud rail: он должен вести в компанию, deal, dispatch и документы, а не быть просто флажком." compact />
        <DetailHero
          kicker="Suspicion case"
          title={suspect.summary}
          description={`Score ${suspect.score}/100. Показываем origin сигнала, linked rails и следующий owner action по контрагенту / рейсу / документам.`}
          chips={[suspect.priority, suspect.origin, suspect.owner, suspect.status]}
          nextStep={suspect.nextAction}
          owner={suspect.owner}
          blockers={suspect.watchouts.join(' · ')}
          actions={[
            { href: '/anti-fraud', label: 'Назад в anti-fraud' },
            suspect.companyId ? { href: `/companies/${suspect.companyId}`, label: 'Открыть компанию', variant: 'secondary' } : { href: '/companies', label: 'Компании', variant: 'secondary' },
            { href: '/documents', label: 'Documents', variant: 'secondary' },
          ]}
        />
        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Почему сигнал поднялся</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              {suspect.reasons.map((item) => (
                <div key={item} className="list-row"><span>{item}</span><span className="mini-chip">reason</span></div>
              ))}
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Какие rails проверить</div>
            <div className="detail-meta" style={{ marginTop: 12 }}>
              {suspect.linkedRails.map((item) => <span key={item} className="mini-chip">{item}</span>)}
            </div>
            <div className="muted small" style={{ marginTop: 16 }}>Каждый сигнал должен указывать, какие реальные rails нужно открыть для проверки: компания, documents, dispatch, payments.</div>
          </div>
        </div>
        <ModuleHub
          title="Следующие действия по сигналу"
          subtitle="Anti-fraud rail не должен быть тупиком. Он обязан открывать конкретные рабочие модули и owner action."
          items={[
            suspect.companyId ? { href: `/companies/${suspect.companyId}`, label: 'Company rail', detail: 'Проверить KYB, trust и историю контрагента.', icon: '⌘', meta: suspect.companyId, tone: 'blue' } : { href: '/companies', label: 'Companies', detail: 'Открыть каталог контрагентов.', icon: '⌘', meta: 'open', tone: 'blue' },
            { href: '/documents', label: 'Documents', detail: 'Сверить документы и evidence, которые привели к сигналу.', icon: '⌁', meta: 'evidence', tone: 'green' },
            { href: '/dispatch', label: 'Dispatch / logistics', detail: 'Если сигнал идёт от маршрута или перевозчика — открыть рейс и dispatch rail.', icon: '🧭', meta: 'routing', tone: 'amber' },
            { href: '/payments', label: 'Payments', detail: 'Если подозрение связано с money path — проверить release blockers.', icon: '₽', meta: 'money', tone: 'gray' },
          ]}
        />
        <NextStepBar
          title="Открыть следующий rail по сигналу"
          detail={suspect.nextAction}
          primary={{ href: suspect.companyId ? `/companies/${suspect.companyId}` : '/companies', label: suspect.companyId ? 'Открыть компанию' : 'Открыть компании' }}
          secondary={[{ href: '/documents', label: 'Documents' }, { href: '/dispatch', label: 'Dispatch' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
