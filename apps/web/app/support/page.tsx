'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../../lib/api-client';
import { CardSkeleton } from '../../components/skeleton';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { SourceNote } from '../../components/source-note';
import { PageFrame } from '../../components/page-frame';
import { DetailHero } from '../../components/detail-hero';
import { CriticalBlockersPanel } from '../../components/critical-blockers-panel';
import { PageAccessGuard } from '../../components/page-access-guard';
import { ALL_AUTHENTICATED_ROLES } from '../../lib/route-roles';

type Ticket = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  requesterUser?: { fullName?: string; email?: string };
  assigneeUser?: { fullName?: string; email?: string };
  linkedDeal?: { id: string };
  updatedAt?: string;
  messagesCount?: number;
  internalNotesCount?: number;
  slaDeadlineAt?: string;
  overdue?: boolean;
  escalation?: string;
  ownerLabel?: string;
  nextAction?: string;
  source?: string;
};

function SupportPage() {
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Ticket[]>('/support/tickets')
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Не удалось загрузить обращения'))
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => ({
    open: items.filter((item) => ['OPEN', 'IN_PROGRESS', 'WAITING_CLIENT', 'WAITING_INTERNAL'].includes(String(item.status))).length,
    overdue: items.filter((item) => item.overdue).length,
    escalations: items.filter((item) => item.escalation === 'ESCALATE').length,
    internalNotes: items.reduce((sum, item) => sum + Number(item.internalNotesCount || 0), 0)
  }), [items]);

  const blockers = [
    summary.overdue > 0 ? `просрочены по SLA: ${summary.overdue}` : null,
    summary.escalations > 0 ? `ожидают эскалации: ${summary.escalations}` : null,
    error ? `ошибка загрузки: ${error}` : null
  ];

  return (
    <PageFrame
      title="Поддержка"
      subtitle="Тикеты, ответственный, SLA, эскалации и связанные сделки в одном каноническом контуре."
      breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Поддержка' }]} />}
    >
      <SourceNote source={items[0]?.source || 'canonical.support.workspace'} warning="Контур поддержки должен использоваться как основной рабочий контур, а не как дополнение к звонкам и чатам." compact />

      <DetailHero
        kicker="Канонический контур поддержки"
        title="Очередь обращений и SLA"
        description="Показываем только то, что требует действия: просрочки, эскалации, связанные сделки и следующий шаг по каждому обращению."
        chips={[
          <span key="open">Активные {summary.open}</span>,
          <span key="overdue">Просрочки SLA {summary.overdue}</span>,
          <span key="esc">Эскалации {summary.escalations}</span>
        ]}
        nextStep={items[0]?.nextAction || (summary.overdue > 0 ? 'Закрыть просроченные обращения' : 'Проверить новые обращения и назначить ответственного')}
        owner="поддержка / оператор"
        blockers={blockers.filter(Boolean).join(' · ') || 'критических блокеров нет'}
        actions={[
          { href: '/support', label: 'Обновить очередь' },
          { href: '/disputes', label: 'Открыть споры', variant: 'secondary' }
        ]}
        extra={<SourceNote source={items[0]?.source || 'canonical.support.workspace'} compact />}
      />

      <CriticalBlockersPanel items={blockers} emptyLabel="Критические блокеры по поддержке не обнаружены." />

      <div className="grid md:grid-cols-4 gap-3">
        <div className="border rounded-xl p-4"><div className="text-xs text-muted-foreground">Активные тикеты</div><div className="text-2xl font-bold mt-1">{summary.open}</div></div>
        <div className="border rounded-xl p-4"><div className="text-xs text-muted-foreground">Просрочены по SLA</div><div className="text-2xl font-bold mt-1">{summary.overdue}</div></div>
        <div className="border rounded-xl p-4"><div className="text-xs text-muted-foreground">Эскалации</div><div className="text-2xl font-bold mt-1">{summary.escalations}</div></div>
        <div className="border rounded-xl p-4"><div className="text-xs text-muted-foreground">Внутренние заметки</div><div className="text-2xl font-bold mt-1">{summary.internalNotes}</div></div>
      </div>

      {loading && <div className="space-y-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>}
      {!loading && error && <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl p-4 text-sm">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="border rounded-xl p-8 text-center">
          <p className="text-muted-foreground">Обращений пока нет.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} href={`/support/${item.id}`} className="mobile-list-card hover:shadow-sm transition">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="font-medium">{item.title || item.id}</div>
                  <div className="text-sm text-muted-foreground">{item.description || 'Без описания'}</div>
                  <div className="text-xs text-muted-foreground">
                    Заявитель: {item.requesterUser?.fullName || item.requesterUser?.email || '—'}
                    {' · '}
                    Ответственный: {item.ownerLabel || item.assigneeUser?.fullName || item.assigneeUser?.email || 'не назначен'}
                    {item.linkedDeal?.id ? ` · Сделка ${item.linkedDeal.id}` : ''}
                  </div>
                  <div className="text-xs text-muted-foreground">Следующий шаг: {item.nextAction || '—'} · SLA до {item.slaDeadlineAt ? new Date(item.slaDeadlineAt).toLocaleString('ru-RU') : '—'}</div>
                </div>
                <div className="text-right space-y-2">
                  <div className="flex items-center gap-2 justify-end text-xs">
                    <span className="px-2 py-0.5 rounded bg-muted">{item.priority || 'MEDIUM'}</span>
                    <span className={`px-2 py-0.5 rounded ${item.overdue ? 'bg-red-100 text-red-700' : 'bg-muted'}`}>{item.status || 'OPEN'}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">messages {item.messagesCount || 0} · internal {item.internalNotesCount || 0}</div>
                  {item.escalation === 'ESCALATE' ? <div className="text-xs text-red-600">Требует эскалации</div> : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageFrame>
  );
}

export default function SupportPageGuarded(props: any) {
  return (
    <PageAccessGuard allowedRoles={ALL_AUTHENTICATED_ROLES} title="Поддержка доступна только после входа" subtitle="Тикеты, ответственный и SLA доступны только авторизованным ролям.">
      <SupportPage {...props} />
    </PageAccessGuard>
  );
}
