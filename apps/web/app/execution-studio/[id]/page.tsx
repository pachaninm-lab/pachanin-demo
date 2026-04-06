import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { AppShell } from '../../../components/app-shell';

const RUNBOOKS: Record<string, { title: string; lead: string; checklist: string[]; handoff: string[] }> = {
  'runbook-buy-side': {
    title: 'Buy-side execution',
    lead: 'Оператор покупателя',
    checklist: ['Сверить лот и buyer shortlist', 'Проверить docs completeness и NTB readiness', 'Сформировать transport + lab route', 'Проверить release path по payment waterfall'],
    handoff: ['Dispatch rail', 'Lab rail', 'Documents', 'Payments'],
  },
  'runbook-farmer-side': {
    title: 'Farmer-side execution',
    lead: 'Оператор продавца',
    checklist: ['Проверить lot owner action', 'Согласовать транспортное плечо', 'Подготовить документы и slot', 'Передать статус в dispatch / receiving'],
    handoff: ['Lots', 'Dispatch', 'Receiving', 'Documents'],
  },
};

export default function ExecutionStudioDetailPage({ params }: { params: { id: string } }) {
  const item = RUNBOOKS[params.id];
  if (!item) notFound();

  return (
    <PageFrame title={item.title} subtitle="Runbook внутри execution studio: кто owner, что проверить и куда передать дальше." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/execution-studio', label: 'Execution studio' }, { label: item.title }]} />}>
      <SourceNote source="execution studio / embedded scenario" warning="Карточка runbook — не knowledge note. Она нужна, чтобы довести пользователя в следующий rail без ручного поиска." compact />
      <DetailHero
        kicker="Runbook"
        title={item.title}
        description="Execution studio должен быть рабочим операторским хабом: checklists, owner, next rails и handoff по реальному сценарию."
        chips={[item.lead, `${item.checklist.length} checks`, `${item.handoff.length} handoffs`]}
        nextStep="Пройти checklist и сразу открыть следующий rail."
        owner={item.lead}
        blockers="Если runbook не переводит в следующий rail, студия превращается в статичную справку."
        actions={[
          { href: '/execution-studio', label: 'Назад в studio' },
          { href: '/dispatch', label: 'Dispatch', variant: 'secondary' },
          { href: '/documents', label: 'Documents', variant: 'secondary' },
        ]}
      />
      <div className="mobile-two-grid">
        <div className="section-card-tight">
          <div className="section-title">Checklist</div>
          <div className="section-stack" style={{ marginTop: 12 }}>
            {item.checklist.map((step) => (
              <div key={step} className="list-row"><span>{step}</span><span className="mini-chip">check</span></div>
            ))}
          </div>
        </div>
        <div className="section-card-tight">
          <div className="section-title">Handoff rails</div>
          <div className="detail-meta" style={{ marginTop: 12 }}>
            {item.handoff.map((rail) => <span key={rail} className="mini-chip">{rail}</span>)}
          </div>
        </div>
      </div>
      <ModuleHub
        title="Следующие rails"
        subtitle="Runbook обязан вести дальше в активные модули, а не заканчиваться на карточке."
        items={item.handoff.map((rail, index) => ({ href: rail === 'Dispatch rail' || rail === 'Dispatch' ? '/dispatch' : rail === 'Lab rail' ? '/lab' : rail === 'Documents' ? '/documents' : rail === 'Payments' ? '/payments' : rail === 'Receiving' ? '/receiving' : '/lots', label: rail, detail: 'Открыть следующий рабочий rail по сценарию.', icon: index === 0 ? '→' : index === 1 ? '⌁' : '≣', meta: 'handoff', tone: index === 0 ? 'blue' : index === 1 ? 'green' : 'gray' }))}
      />
      <NextStepBar
        title="Перейти из runbook в рабочий rail"
        detail={`Lead: ${item.lead}`}
        primary={{ href: '/dispatch', label: 'Открыть следующий rail' }}
        secondary={[{ href: '/documents', label: 'Documents' }, { href: '/payments', label: 'Payments' }]}
      />
    </PageFrame>
  );
}
