import { notFound } from 'next/navigation';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { readCommercialWorkspace } from '../../../lib/commercial-workspace-store';

export default async function ChatDetailPage({ params }: { params: { id: string } }) {
  const state = await readCommercialWorkspace();
  const thread = state.chatThreads.find((item) => item.id === params.id) || null;
  if (!thread) notFound();

  return (
    <PageFrame title={thread.counterparty} subtitle={`${thread.topic} · ${thread.lastMessageAt}`} breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/chats', label: 'Чаты' }, { label: thread.counterparty }]} />}>
      <SourceNote source="commercial workspace / chat projection" warning="Карточка чата нужна не ради переписки как таковой, а чтобы переводить разговор в lot/deal/dispatch rail без потери контекста." compact />
      <DetailHero
        kicker="Chat thread"
        title={thread.counterparty}
        description={thread.topic}
        chips={[thread.status, thread.owner, thread.lastMessageAt]}
        nextStep={thread.nextAction}
        owner={thread.owner}
        blockers={thread.blockers.join(' · ')}
        actions={[
          thread.primaryHref ? { href: thread.primaryHref, label: 'Открыть связанный rail' } : { href: '/deals', label: 'Сделки' },
          { href: '/chats', label: 'Назад в чаты', variant: 'secondary' },
        ]}
      />
      <section className="section-card-tight">
        <div className="section-title">Лента переписки</div>
        <div className="section-stack" style={{ marginTop: 12 }}>
          {thread.messages.map((item) => (
            <div key={item.id} className="list-row">
              <div>
                <div style={{ fontWeight: 700 }}>{item.author}</div>
                <div className="muted small">{item.text}</div>
              </div>
              <span className="mini-chip">{item.at}</span>
            </div>
          ))}
        </div>
      </section>
      <ModuleHub
        title="Следующие rails"
        subtitle="Чат не должен быть тупиком. После согласования пользователь должен уходить в lot / deal / dispatch rail."
        items={thread.linkedRails.map((item, index) => ({ href: item.href, label: item.label, detail: 'Открыть связанный рабочий rail без ручного поиска.', icon: index === 0 ? '→' : index === 1 ? '⌁' : '≣', meta: item.meta, tone: index === 0 ? 'blue' : index === 1 ? 'green' : 'gray' }))}
      />
      <NextStepBar
        title="Перейти из переписки в рабочий rail"
        detail={thread.nextAction}
        primary={{ href: thread.primaryHref || '/deals', label: 'Открыть rail' }}
        secondary={[{ href: '/lots', label: 'Lots' }, { href: '/dispatch', label: 'Dispatch' }]}
      />
    </PageFrame>
  );
}
