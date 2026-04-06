import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { readCommercialWorkspace } from '../../../lib/commercial-workspace-store';

export default async function KnowledgeDetailPage({ params }: { params: { id: string } }) {
  const state = await readCommercialWorkspace();
  const entry = state.knowledgeEntries.find((item) => item.id === params.id) || null;

  if (!entry) {
    return (
      <PageFrame title="Knowledge entry не найден" subtitle="Карточка knowledge отсутствует в текущем workspace.">
        <div className="section-card">
          <div className="section-title">Нет данных</div>
          <div className="muted" style={{ marginTop: 8 }}>Вернись в knowledge rail и открой актуальную заметку.</div>
          <div className="cta-stack" style={{ marginTop: 16 }}>
            <Link href="/knowledge" className="primary-link">Knowledge rail</Link>
            <Link href="/support" className="secondary-link">Support</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame title={entry.title} subtitle={`${entry.category} · ${entry.owner}`} breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/knowledge', label: 'Knowledge' }, { label: entry.title }]} />}>
      <SourceNote source="commercial workspace / knowledge projection" warning="Knowledge entry — это рабочая памятка, которая должна вести пользователя в следующий rail, а не просто хранить текст." compact />
      <DetailHero
        kicker="Knowledge entry"
        title={entry.title}
        description={entry.summary}
        chips={[entry.category, entry.owner, entry.updatedAt]}
        nextStep={entry.nextAction}
        owner={entry.owner}
        blockers={entry.blockers.join(' · ')}
        actions={[
          { href: '/knowledge', label: 'Назад в knowledge' },
          { href: entry.primaryHref || '/support', label: 'Открыть связанный rail', variant: 'secondary' },
        ]}
      />
      <div className="section-card-tight">
        <div className="section-title">Ключевые тезисы</div>
        <div className="section-stack" style={{ marginTop: 12 }}>
          {entry.points.map((item) => (
            <div key={item} className="list-row"><span>{item}</span><span className="mini-chip">point</span></div>
          ))}
        </div>
      </div>
      <ModuleHub
        title="Связанные rails"
        subtitle="Knowledge должен вести дальше в support / operations / documents, а не быть изолированной вики-страницей."
        items={entry.linkedRails.map((item, index) => ({ href: item.href, label: item.label, detail: 'Открыть связанный рабочий rail прямо из knowledge entry.', icon: index === 0 ? '→' : index === 1 ? '⌁' : '≣', meta: item.meta, tone: index === 0 ? 'blue' : index === 1 ? 'green' : 'gray' }))}
      />
      <NextStepBar
        title="Открыть следующий рабочий rail"
        detail={entry.nextAction}
        primary={{ href: entry.primaryHref || '/support', label: 'Открыть rail' }}
        secondary={[{ href: '/support', label: 'Support' }, { href: '/documents', label: 'Documents' }]}
      />
    </PageFrame>
  );
}
