'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../../../lib/api-client';
import { CardSkeleton } from '../../../components/skeleton';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { SourceNote } from '../../../components/source-note';
import { PageFrame } from '../../../components/page-frame';
import { DetailHero } from '../../../components/detail-hero';
import { CriticalBlockersPanel } from '../../../components/critical-blockers-panel';
import { NextStepBar } from '../../../components/next-step-bar';
import { OperationalStatePanel } from '../../../components/operational-state-panel';
import { ModuleHub } from '../../../components/module-hub';
import { ActionOutcomePanel } from '../../../components/action-outcome-panel';
import { normalizeBlockers } from '../../../lib/operational-vocabulary';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { ALL_AUTHENTICATED_ROLES } from '../../../lib/route-roles';

const TRANSITIONS = ['IN_PROGRESS', 'WAITING_CLIENT', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED'];

type Ticket = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  linkedDeal?: { id: string; lot?: { title?: string } };
  requesterUser?: { fullName?: string; email?: string };
  assigneeUser?: { fullName?: string; email?: string };
  messages?: Array<{ id: string; text?: string; isInternal?: boolean; createdAt?: string; senderUser?: { fullName?: string; email?: string } }>;
  updatedAt?: string;
  ownerLabel?: string;
  requesterLabel?: string;
  messagesCount?: number;
  internalNotesCount?: number;
  slaDeadlineAt?: string;
  overdue?: boolean;
  escalation?: string;
  nextAction?: string;
  linkedEntity?: { type?: string; id?: string; href?: string };
  source?: string;
};

function SupportDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');
  const [lastAction, setLastAction] = useState<{ tone: 'green' | 'amber' | 'red'; title: string; detail: string; badge?: string } | null>(null);

  const load = async () => {
    const item = await api.get<Ticket>(`/support/tickets/${params.id}`);
    setData(item);
    setStatusDraft(item?.status || 'OPEN');
  };

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Не удалось загрузить карточку обращения'))
      .finally(() => setLoading(false));
  }, [params.id]);

  const blockers = useMemo(() => {
    if (!data) return [] as string[];
    const raw = [
      data.overdue ? 'обращение просрочено по SLA' : null,
      data.escalation === 'ESCALATE' ? 'требуется эскалация' : null,
      !data.assigneeUser?.fullName && !data.assigneeUser?.email && !data.ownerLabel ? 'не назначен ответственный' : null,
      !data.linkedEntity && !data.linkedDeal ? 'нет связанного рабочего объекта' : null,
      error ? `ошибка: ${error}` : null
    ];
    return normalizeBlockers(raw);
  }, [data, error]);

  const linkedHref = data?.linkedEntity?.href || (data?.linkedDeal?.id ? `/deals/${data.linkedDeal.id}` : '');
  const owner = data?.ownerLabel || data?.assigneeUser?.fullName || data?.assigneeUser?.email || 'не назначен';
  const requester = data?.requesterLabel || data?.requesterUser?.fullName || data?.requesterUser?.email || 'не указан';

  const saveStatus = async () => {
    if (!data) return;
    setSaving(true);
    setLastAction(null);
    try {
      const updated = await api.patch<Ticket>(`/support/tickets/${data.id}/status`, { status: statusDraft });
      setData(updated);
      setStatusDraft(updated.status || statusDraft);
      setLastAction({ tone: 'green', title: 'Статус обновлён', detail: `Новый статус: ${updated.status || statusDraft}. Следующий шаг: ${updated.nextAction || 'проверить очередь.'}`, badge: updated.status || statusDraft });
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Не удалось обновить статус обращения';
      setLastAction({ tone: 'red', title: 'Ошибка обновления', detail: message, badge: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]} title="Карточка поддержки доступна только после входа" subtitle="Рабочее обращение доступно только авторизованным ролям.">
        <PageFrame title={`Обращение · ${params.id}`} subtitle="Загрузка детальной карточки обращения.">
          <div className="space-y-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
        </PageFrame>
      </PageAccessGuard>
    );
  }

  return (
    <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]} title="Карточка поддержки доступна только после входа" subtitle="Рабочее обращение доступно только авторизованным ролям.">
      <PageFrame title={`Поддержка · ${data?.id || params.id}`} subtitle={data?.title || 'Карточка обращения и следующий рабочий шаг.'} breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/support', label: 'Поддержка' }, { label: data?.id || params.id }]} />}>
        {!data ? (
          <OperationalStatePanel source="canonical.support.ticket" title="Карточка обращения не найдена" detail={error || 'Обращение не вернулось из канонического support-контура. Вернись в очередь и обнови данные.'} primary={{ href: '/support', label: 'Назад в поддержку' }} secondary={[{ href: '/disputes', label: 'Открыть споры' }]} />
        ) : (
          <div className="space-y-6 mobile-page-bottom-space">
            <SourceNote source={data.source || 'canonical.support.ticket'} updatedAt={data.updatedAt} warning={data.overdue ? 'SLA уже нарушен. Сначала нужно снять blocker и только потом закрывать тикет.' : 'Карточка обращения должна вести в связанный модуль и помогать оператору завершить шаг, а не просто фиксировать переписку.'} compact />

            <DetailHero
              kicker="Support ticket"
              title={data.title || data.id}
              description={data.description || 'Описание не заполнено. Всё равно должен быть понятен linked object и owner action.'}
              chips={[
                <span key="status">{data.status || 'OPEN'}</span>,
                <span key="priority">{data.priority || 'MEDIUM'}</span>,
                <span key="owner">{owner}</span>
              ]}
              nextStep={data.nextAction || 'Открыть связанный объект и снять blocker обращения'}
              owner={owner}
              blockers={blockers.join(' · ') || 'критических блокеров нет'}
              actions={[
                linkedHref ? { href: linkedHref, label: 'Открыть связанный объект' } : { href: '/support', label: 'Очередь обращений' },
                { href: '/support', label: 'Назад в очередь', variant: 'secondary' },
                data.linkedDeal?.id ? { href: `/deals/${data.linkedDeal.id}`, label: 'Открыть сделку', variant: 'secondary' } : { href: '/disputes', label: 'Открыть споры', variant: 'secondary' }
              ]}
            />

            <CriticalBlockersPanel items={blockers} emptyLabel="Критических блокеров по обращению не обнаружено." />

            <div className="info-grid-2">
              <div className="section-card">
                <div className="section-title">Контекст обращения</div>
                <div className="info-grid-2" style={{ marginTop: 12 }}>
                  <div className="info-card"><div className="label">Заявитель</div><div className="value">{requester}</div></div>
                  <div className="info-card"><div className="label">Ответственный</div><div className="value">{owner}</div></div>
                  <div className="info-card"><div className="label">Связанная сделка</div><div className="value">{data.linkedDeal?.id || '—'}</div></div>
                  <div className="info-card"><div className="label">Связанный объект</div><div className="value">{data.linkedEntity?.type ? `${data.linkedEntity.type} · ${data.linkedEntity.id || ''}` : '—'}</div></div>
                </div>
              </div>

              <div className="section-card">
                <div className="section-title">Обновить статус</div>
                <div className="flex flex-col gap-3 mt-4">
                  <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} className="rounded-xl border px-4 py-3 text-sm bg-background">
                    {TRANSITIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <button onClick={saveStatus} disabled={saving} className="button primary compact">{saving ? 'Сохраняю…' : 'Сохранить статус'}</button>
                  <div className="text-xs text-muted-foreground">Статус не должен жить отдельно. После изменения следующий owner action должен быть понятен из linked object.</div>
                </div>
              </div>
            </div>

            {lastAction ? <ActionOutcomePanel tone={lastAction.tone} title={lastAction.title} detail={lastAction.detail} badge={lastAction.badge} /> : null}

            <div className="section-card">
              <div className="section-title">Лента сообщений</div>
              <div className="space-y-3 mt-4">
                {(data.messages || []).length === 0 && <div className="text-sm text-muted-foreground">Сообщений пока нет.</div>}
                {(data.messages || []).map((msg) => (
                  <div key={msg.id} className={`rounded-2xl border p-4 ${msg.isInternal ? 'bg-amber-50 border-amber-200' : 'bg-background'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-sm">{msg.senderUser?.fullName || msg.senderUser?.email || 'Автор не указан'}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{msg.createdAt ? String(msg.createdAt).slice(0, 16).replace('T', ' ') : '—'} {msg.isInternal ? '· внутренняя заметка' : ''}</div>
                      </div>
                      {msg.isInternal ? <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">internal</span> : null}
                    </div>
                    <div className="text-sm mt-3 whitespace-pre-wrap">{msg.text || 'Без текста'}</div>
                  </div>
                ))}
              </div>
            </div>

            <ModuleHub
              title="Связанные рабочие модули"
              subtitle="Из карточки обращения пользователь должен уходить в модуль, где реально снимается blocker."
              items={[
                linkedHref ? { href: linkedHref, label: data.linkedEntity?.type || data.linkedDeal?.id || 'Связанный объект', detail: 'Открыть объект, который породил обращение, и продолжить работу там.', icon: '→', meta: data.linkedEntity?.id || data.linkedDeal?.id || 'object', tone: 'blue' } : { href: '/support', label: 'Очередь', detail: 'Вернуться в общий контур поддержки.', icon: '→', meta: 'queue', tone: 'blue' },
                data.linkedDeal?.id ? { href: `/deals/${data.linkedDeal.id}`, label: 'Сделка', detail: 'Проверить blockers сделки и связанные события.', icon: '⌁', meta: data.linkedDeal.id, tone: 'green' } : { href: '/disputes', label: 'Споры', detail: 'Если проблема спорная, открыть dispute rail.', icon: '⌁', meta: 'dispute', tone: 'green' },
                { href: '/notifications', label: 'Уведомления', detail: 'Проверить сигналы и follow-up по этому кейсу.', icon: '≣', meta: 'signals', tone: 'amber' },
                { href: '/support', label: 'Очередь поддержки', detail: 'Вернуться к общей очереди и проверить соседние тикеты.', icon: '≣', meta: 'queue', tone: 'gray' },
              ]}
            />

            <NextStepBar
              title={data.nextAction || 'Открыть связанный объект и снять blocker'}
              detail="Поддержка не заканчивается на статусе. Она должна приводить пользователя туда, где проблема реально решается."
              primary={linkedHref ? { href: linkedHref, label: 'Открыть связанный объект' } : { href: '/support', label: 'Назад в очередь' }}
              secondary={[{ href: '/notifications', label: 'Уведомления' }, { href: '/support', label: 'Очередь' }]}
            />
          </div>
        )}
      </PageFrame>
    </PageAccessGuard>
  );
}

export default SupportDetailPage;
