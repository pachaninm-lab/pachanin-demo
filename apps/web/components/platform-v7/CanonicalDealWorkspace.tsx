'use client';

import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Truck,
  Wheat,
} from 'lucide-react';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import {
  enqueueCommand,
  flushPendingCommand,
  isNetworkFailure,
  pendingForDeal,
  type PendingCommand,
} from '@/lib/platform-v7/offline-command-queue';

const DEAL_ID = 'DEAL-INDUSTRIAL-001';

type SpineState = 'done' | 'active' | 'pending';
type ActionSource = 'USER' | 'BANK_CALLBACK';

type Workspace = {
  deal: {
    id: string;
    number: string | null;
    status: string;
    updatedAt: string;
    culture: string | null;
    cropClass: string | null;
    volumeTons: number | null;
    pricePerTon: number | null;
    totalKopecks: number | null;
    currency: string;
  };
  roleProjection: {
    role: string;
    focus: string;
    canAct: boolean;
    primaryAction: null | {
      id: string;
      label: string;
      enabled: boolean;
      source?: ActionSource;
      waitingForRoles: string[];
    };
  };
  attention: string;
  blockers: string[];
  money: null | {
    status: string;
    amountKopecks: number | null;
    callbackState: string;
    bankRef: string | null;
  };
  spine: Array<{
    id: string;
    stage: string;
    label: string;
    source?: ActionSource;
    state: SpineState;
  }>;
  shipments: Array<{ id: string; status: string; vehicleNumber?: string | null; nextAction?: string | null }>;
  documents: Array<{ id: string; type: string; status: string; name: string }>;
  laboratory: Array<{ id: string; status: string; protocol?: string | null }>;
  acceptance: Array<{ id: string; status: string; weightActualTons?: number | null; qualityStatus: string }>;
  disputes: Array<{ id: string; status: string; description: string }>;
  timeline: Array<{ id: string; eventType: string; createdAt: string }>;
};

type CommandResult = {
  ok: boolean;
  duplicate?: boolean;
  status?: string;
  updatedAt?: string;
  message?: string;
};

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value / 100);
}

function tons(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} т`;
}

function roleLabel(role: PlatformRole): string {
  const labels: Record<PlatformRole, string> = {
    operator: 'Оператор',
    buyer: 'Покупатель',
    seller: 'Продавец',
    logistics: 'Логистика',
    driver: 'Водитель',
    surveyor: 'Сюрвейер',
    elevator: 'Элеватор',
    lab: 'Лаборатория',
    bank: 'Банк',
    arbitrator: 'Арбитр',
    compliance: 'Комплаенс',
    executive: 'Руководитель',
  };
  return labels[role];
}

function commandPayload(actionId: string): Record<string, unknown> {
  if (actionId === 'assign_logistics') {
    return {
      carrierOrgId: 'org-canonical-logistics',
      driverUserId: 'user-driver-001',
      driverName: 'Тестовый водитель',
      vehicleNumber: 'А001АА77',
      routeFrom: 'Склад продавца',
      routeTo: 'Элеватор покупателя',
    };
  }
  if (actionId === 'confirm_loading') return { loadedTons: 150 };
  if (actionId === 'confirm_arrival') return { lat: 52.7212, lng: 41.4523 };
  if (actionId === 'confirm_weight') return { weightActualTons: 149.6 };
  if (actionId === 'finalize_lab') return { moisture: 12.4, protein: 13.2, gost: 'ГОСТ 9353-2016' };
  return {};
}

function waitingLabel(action: Workspace['roleProjection']['primaryAction']): string {
  if (!action) return '';
  if (action.source === 'BANK_CALLBACK' || action.waitingForRoles.includes('BANK_CALLBACK')) {
    return 'подтверждённый callback банка';
  }
  return action.waitingForRoles.join(', ');
}

class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function readJson(response: Response): Promise<any> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join(' · ')
      : payload?.message || payload?.error || `Ошибка ${response.status}`;
    throw new HttpError(typeof message === 'string' ? message : JSON.stringify(message), response.status);
  }
  return payload;
}

/**
 * Рабочее место сделки. Работает для любой сделки, доступной участнику:
 * dealId приходит параметром; по умолчанию — каноническая тестовая сделка.
 */
export function CanonicalDealWorkspace({ role, dealId = DEAL_ID }: { role: PlatformRole; dealId?: string }) {
  const [workspace, setWorkspace] = React.useState<Workspace | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [pendingSync, setPendingSync] = React.useState<PendingCommand | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/proxy/deals/${dealId}/execution-workspace`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const payload = await readJson(response) as Workspace;
      setWorkspace(payload);
    } catch (reason) {
      setWorkspace(null);
      setError(reason instanceof Error ? reason.message : 'Не удалось загрузить сделку.');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  // Отложенная (офлайн) команда этой сделки: доставляем при появлении связи.
  // Сервер идемпотентен, поэтому повторная доставка безопасна и никогда не
  // исполняет действие дважды.
  const flushOffline = React.useCallback(async () => {
    if (!pendingForDeal(dealId)) {
      setPendingSync(null);
      return;
    }
    const { outcome, message } = await flushPendingCommand(dealId);
    if (outcome === 'still-offline') {
      setPendingSync(pendingForDeal(dealId) ?? null);
      return;
    }
    setPendingSync(null);
    if (outcome === 'delivered') {
      setNotice('Связь восстановлена: сохранённое действие доставлено и подтверждено сервером.');
    } else if (outcome === 'conflict') {
      setNotice('Данные изменились другим участником. Мы обновили экран — проверьте состояние и повторите действие.');
    } else {
      setError(message || 'Сохранённое действие отклонено сервером.');
    }
    await load();
  }, [dealId, load]);

  React.useEffect(() => {
    void load();
    setPendingSync(pendingForDeal(dealId) ?? null);
    void flushOffline();
    const onOnline = () => void flushOffline();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [dealId, load, flushOffline]);

  async function executePrimaryAction() {
    const action = workspace?.roleProjection.primaryAction;
    const isSystemAction = action?.source === 'BANK_CALLBACK' || action?.waitingForRoles.includes('BANK_CALLBACK');
    if (!workspace || !action?.enabled || isSystemAction || submitting || pendingSync) return;

    const commandId = globalThis.crypto?.randomUUID?.() ?? `command-${Date.now()}`;
    const idempotencyKey = `${workspace.deal.id}:${action.id}:${commandId}`;
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/proxy/deals/${workspace.deal.id}/commands/${action.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          commandId,
          idempotencyKey,
          expectedUpdatedAt: workspace.deal.updatedAt,
          ...(typeof (workspace.deal as { version?: number }).version === 'number'
            ? { expectedVersion: String((workspace.deal as { version?: number }).version) }
            : {}),
          payload: commandPayload(action.id),
        }),
      });
      const result = await readJson(response) as CommandResult;
      setNotice(result.duplicate ? 'Команда уже была принята ранее. Показан подтверждённый результат.' : 'Действие подтверждено сервером и записано в журнал сделки.');
      await load();
    } catch (reason) {
      if (reason instanceof HttpError && reason.status === 409) {
        // Optimistic-concurrency conflict: другой участник изменил сделку.
        // Не ошибка пользователя — обновляем экран и объясняем простыми словами.
        setNotice('Данные изменились другим участником. Мы обновили экран — проверьте состояние и повторите действие.');
        await load();
      } else if (isNetworkFailure(reason)) {
        // Обрыв связи в поле: действие сохраняется на устройстве с теми же
        // commandId/idempotencyKey и уходит автоматически при появлении сети.
        const saved = enqueueCommand({
          dealId: workspace.deal.id,
          actionId: action.id,
          commandId,
          idempotencyKey,
          expectedUpdatedAt: workspace.deal.updatedAt,
          ...(typeof (workspace.deal as { version?: number }).version === 'number'
            ? { expectedVersion: String((workspace.deal as { version?: number }).version) }
            : {}),
          payload: commandPayload(action.id),
        });
        setPendingSync(saved);
        setNotice('Нет связи. Действие сохранено на устройстве и будет отправлено автоматически, когда сеть появится.');
      } else {
        setError(reason instanceof Error ? reason.message : 'Команда не выполнена.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !workspace) {
    return (
      <section className='deal-loading' aria-live='polite'>
        <Loader2 size={24} className='spin' />
        <strong>Загружаем единую сделку…</strong>
        <style jsx>{styles}</style>
      </section>
    );
  }

  if (!workspace) {
    return (
      <section className='deal-error' role='alert'>
        <AlertTriangle size={25} />
        <div><strong>Рабочая сделка недоступна</strong><p>{error || 'Backend не вернул подтверждённое состояние.'}</p></div>
        <button type='button' onClick={() => void load()}><RefreshCw size={17} />Повторить</button>
        <style jsx>{styles}</style>
      </section>
    );
  }

  const activeStep = workspace.spine.find((step) => step.state === 'active');
  const action = workspace.roleProjection.primaryAction;
  const systemAction = action?.source === 'BANK_CALLBACK' || action?.waitingForRoles.includes('BANK_CALLBACK');
  const shipment = workspace.shipments[0];
  const acceptance = workspace.acceptance[0];

  return (
    <section className='deal-workspace' data-canonical-deal={workspace.deal.id} data-role={role}>
      <header className='deal-hero'>
        <div className='deal-hero-copy'>
          <span className='deal-kicker'><Wheat size={16} /> Единая сквозная сделка</span>
          <h1>{workspace.deal.number || workspace.deal.id}</h1>
          <p>{workspace.deal.culture || 'Зерно'}{workspace.deal.cropClass ? ` · ${workspace.deal.cropClass} класс` : ''} · {tons(workspace.deal.volumeTons)}</p>
        </div>
        <div className='deal-status'>
          <small>Текущий этап</small>
          <strong>{activeStep?.stage || (workspace.deal.status === 'CLOSED' ? 'Закрыто' : workspace.deal.status)}</strong>
          <span>{workspace.deal.status}</span>
        </div>
      </header>

      <div className='deal-role-strip'>
        <span><ShieldCheck size={17} />{roleLabel(role)}</span>
        <strong>{workspace.roleProjection.focus}</strong>
      </div>

      <section className={`deal-attention ${workspace.blockers.length ? 'blocked' : ''}`}>
        <div className='attention-icon'>{workspace.blockers.length ? <AlertTriangle size={23} /> : systemAction ? <Banknote size={23} /> : <ArrowRight size={23} />}</div>
        <div>
          <small>{workspace.blockers.length ? 'Стоп-фактор' : systemAction ? 'Ожидаем внешнее подтверждение' : 'Что происходит сейчас'}</small>
          <h2>{workspace.blockers[0] || (systemAction ? 'Банк обрабатывает операцию' : workspace.attention)}</h2>
          {action && !action.enabled ? <p>Следующий подтверждённый шаг выполняет: {waitingLabel(action)}.</p> : null}
        </div>
      </section>

      {error ? <p className='deal-message error' role='alert'>{error}</p> : null}
      {notice ? <p className='deal-message success' role='status'><CheckCircle2 size={17} />{notice}</p> : null}
      {pendingSync ? (
        <p className='deal-message pending' role='status' data-offline-pending={pendingSync.commandId}>
          <Clock3 size={17} />
          Действие ожидает отправки: сохранено на устройстве, отправим автоматически при появлении связи.
          <button type='button' onClick={() => void flushOffline()}>Отправить сейчас</button>
        </p>
      ) : null}

      <div className='deal-metrics'>
        <article><Banknote size={18} /><span><small>Сумма сделки</small><strong>{money(workspace.deal.totalKopecks)}</strong></span></article>
        <article><ShieldCheck size={18} /><span><small>Деньги</small><strong>{workspace.money?.status || 'PENDING'}</strong></span></article>
        <article><Truck size={18} /><span><small>Рейс</small><strong>{shipment?.status || 'Не назначен'}</strong></span></article>
        <article><FileCheck2 size={18} /><span><small>Документы</small><strong>{workspace.documents.filter((item) => item.status === 'SIGNED').length}/{workspace.documents.length || 0} подписано</strong></span></article>
      </div>

      <div className='deal-grid'>
        <section className='deal-spine-card'>
          <div className='section-heading'>
            <div><span>Линия сделки</span><h2>Один путь для всех ролей</h2></div>
            <button type='button' onClick={() => void load()} aria-label='Обновить сделку' disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button>
          </div>
          <ol className='deal-spine'>
            {workspace.spine.map((step) => (
              <li key={step.id} className={step.state}>
                <span className='step-marker'>{step.state === 'done' ? <Check size={15} /> : step.state === 'active' ? <Clock3 size={15} /> : null}</span>
                <div><small>{step.stage}</small><strong>{step.label}</strong></div>
                <em>{step.state === 'done' ? 'Сделано' : step.state === 'active' ? 'Сейчас' : 'Далее'}</em>
              </li>
            ))}
          </ol>
        </section>

        <aside className='deal-side'>
          <section className='deal-action-card'>
            <small>{systemAction ? 'Системное событие' : 'Твоё следующее действие'}</small>
            <h2>{systemAction ? 'Ожидаем подтверждение банка' : action?.label || 'Действий нет'}</h2>
            <p>{systemAction ? 'Состояние изменится только после проверки подписанного банковского callback. Ручное подтверждение невозможно.' : action ? (action.enabled ? 'После подтверждения состояние изменится для всех участников одновременно.' : 'Сейчас действие недоступно этой роли.') : 'Сделка завершена или ожидает системного события.'}</p>
            <button type='button' onClick={() => void executePrimaryAction()} disabled={systemAction || !action?.enabled || submitting || Boolean(pendingSync) || workspace.blockers.length > 0}>
              {submitting ? <Loader2 size={18} className='spin' /> : systemAction ? <Banknote size={18} /> : <ArrowRight size={18} />}
              {submitting ? 'Подтверждаем…' : pendingSync ? 'Ожидает отправки' : systemAction ? 'Ожидаем банк' : action?.label || 'Нет доступных действий'}
            </button>
          </section>

          <section className='deal-facts-card'>
            <h3>Факты сделки</h3>
            <dl>
              <div><dt>Цена</dt><dd>{workspace.deal.pricePerTon ? `${new Intl.NumberFormat('ru-RU').format(workspace.deal.pricePerTon)} ₽/т` : '—'}</dd></div>
              <div><dt>Вес приёмки</dt><dd>{tons(acceptance?.weightActualTons)}</dd></div>
              <div><dt>Качество</dt><dd>{acceptance?.qualityStatus || 'Не проверено'}</dd></div>
              <div><dt>События</dt><dd>{workspace.timeline.length}</dd></div>
              <div><dt>Споры</dt><dd>{workspace.disputes.length}</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      <style jsx>{styles}</style>
    </section>
  );
}

const styles = `
  .deal-workspace{display:grid;gap:14px;color:var(--pc-text-primary)}
  .deal-loading,.deal-error{min-height:220px;border:1px solid var(--pc-border);background:var(--pc-shell-surface);border-radius:24px;display:flex;align-items:center;justify-content:center;gap:12px;padding:24px;color:var(--pc-text-secondary)}
  .deal-error{justify-content:flex-start;flex-wrap:wrap}.deal-error>svg{color:#c2413c}.deal-error div{flex:1;min-width:200px}.deal-error p{margin:4px 0 0;color:var(--pc-text-secondary)}.deal-error button{border:1px solid var(--pc-border);background:var(--pc-shell-surface-soft);color:var(--pc-text-primary);border-radius:13px;min-height:42px;padding:0 14px;display:inline-flex;align-items:center;gap:7px;font-weight:850}
  .deal-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:clamp(20px,4vw,34px);border-radius:28px;background:linear-gradient(135deg,#092d20 0%,#0b5a38 66%,#0a7543 100%);color:#fff;box-shadow:0 24px 55px rgba(8,65,40,.18);overflow:hidden;position:relative}.deal-hero:after{content:"";position:absolute;width:260px;height:260px;border-radius:50%;right:-90px;top:-150px;border:42px solid rgba(255,255,255,.07)}
  .deal-kicker{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:#bce4cb}.deal-hero h1{margin:10px 0 5px;font-size:clamp(34px,7vw,68px);line-height:.95;letter-spacing:-.06em}.deal-hero p{margin:0;color:#d7ebdf;font-weight:700}.deal-status{position:relative;z-index:1;min-width:160px;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(12px)}.deal-status small,.deal-status span{display:block;color:#cbe6d5;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.06em}.deal-status strong{display:block;margin:5px 0;font-size:18px}.deal-role-strip{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 15px;border-radius:16px;background:var(--pc-shell-surface);border:1px solid var(--pc-border)}.deal-role-strip span{display:inline-flex;align-items:center;gap:7px;color:var(--pc-accent);font-size:12px;font-weight:900}.deal-role-strip strong{font-size:13px}
  .deal-attention{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:14px;padding:18px;border:1px solid rgba(8,122,59,.18);background:var(--pc-accent-bg);border-radius:22px}.deal-attention.blocked{border-color:rgba(194,65,60,.28);background:rgba(194,65,60,.07)}.attention-icon{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:var(--pc-shell-surface);color:var(--pc-accent)}.blocked .attention-icon{color:#c2413c}.deal-attention small{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--pc-text-muted);font-weight:900}.deal-attention h2{margin:4px 0 0;font-size:clamp(17px,3vw,23px);line-height:1.2}.deal-attention p{margin:6px 0 0;color:var(--pc-text-secondary);font-size:12px}
  .deal-message{margin:0;padding:12px 14px;border-radius:14px;font-size:13px;font-weight:800;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.deal-message.error{background:#fff1f1;color:#9b2525;border:1px solid #f2c5c5}.deal-message.success{background:#edf8f1;color:#08683a;border:1px solid #c8e8d3}.deal-message.pending{background:#fff8ec;color:#8a5a08;border:1px solid #f0dcb0}.deal-message.pending button{border:1px solid #e0c98c;background:#fff;color:#8a5a08;border-radius:11px;min-height:38px;padding:0 12px;font-weight:850}
  .deal-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.deal-metrics article{display:flex;align-items:center;gap:10px;padding:14px;border-radius:18px;background:var(--pc-shell-surface);border:1px solid var(--pc-border);min-width:0}.deal-metrics svg{color:var(--pc-accent);flex:0 0 auto}.deal-metrics span{display:grid;min-width:0}.deal-metrics small{font-size:10px;color:var(--pc-text-muted);font-weight:850;text-transform:uppercase;letter-spacing:.04em}.deal-metrics strong{margin-top:3px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .deal-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(300px,.55fr);gap:14px;align-items:start}.deal-spine-card,.deal-action-card,.deal-facts-card{border:1px solid var(--pc-border);background:var(--pc-shell-surface);border-radius:24px;box-shadow:var(--pc-shadow-xs)}.deal-spine-card{padding:18px}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.section-heading span{font-size:10px;color:var(--pc-accent);font-weight:900;text-transform:uppercase;letter-spacing:.07em}.section-heading h2{margin:3px 0 0;font-size:20px}.section-heading button{width:40px;height:40px;border-radius:13px;border:1px solid var(--pc-border);background:var(--pc-shell-surface-soft);color:var(--pc-text-secondary);display:grid;place-items:center}.deal-spine{list-style:none;margin:0;padding:0;display:grid}.deal-spine li{position:relative;display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:62px;padding:8px 0}.deal-spine li:not(:last-child):before{content:"";position:absolute;left:15px;top:45px;bottom:-9px;width:2px;background:var(--pc-border)}.step-marker{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;border:2px solid var(--pc-border);background:var(--pc-shell-surface);z-index:1}.deal-spine li.done .step-marker{background:var(--pc-accent);border-color:var(--pc-accent);color:white}.deal-spine li.active .step-marker{border-color:var(--pc-accent);color:var(--pc-accent);box-shadow:0 0 0 5px var(--pc-accent-bg)}.deal-spine li.done:not(:last-child):before{background:var(--pc-accent)}.deal-spine li div{display:grid;gap:2px}.deal-spine small{font-size:10px;color:var(--pc-text-muted);font-weight:850;text-transform:uppercase}.deal-spine strong{font-size:13px;line-height:1.25}.deal-spine em{font-style:normal;font-size:10px;font-weight:900;color:var(--pc-text-muted)}.deal-spine li.active em{color:var(--pc-accent)}
  .deal-side{display:grid;gap:14px}.deal-action-card{padding:20px;background:linear-gradient(180deg,var(--pc-shell-surface),var(--pc-shell-surface-soft))}.deal-action-card>small{font-size:10px;color:var(--pc-accent);font-weight:900;text-transform:uppercase;letter-spacing:.07em}.deal-action-card h2{margin:9px 0 7px;font-size:22px;line-height:1.12}.deal-action-card p{margin:0;color:var(--pc-text-secondary);font-size:12px;line-height:1.55}.deal-action-card button{width:100%;min-height:52px;margin-top:16px;border:0;border-radius:16px;background:var(--pc-accent);color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;font-weight:950;font-size:14px}.deal-action-card button:disabled{background:var(--pc-border);color:var(--pc-text-muted);cursor:not-allowed}.deal-facts-card{padding:18px}.deal-facts-card h3{margin:0 0 10px;font-size:16px}.deal-facts-card dl{margin:0;display:grid}.deal-facts-card dl div{display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-top:1px solid var(--pc-border)}.deal-facts-card dt{font-size:12px;color:var(--pc-text-muted)}.deal-facts-card dd{margin:0;text-align:right;font-size:12px;font-weight:850}.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
  @media(max-width:920px){.deal-grid{grid-template-columns:1fr}.deal-side{grid-template-columns:repeat(2,minmax(0,1fr))}.deal-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:640px){.deal-hero{align-items:flex-start;flex-direction:column}.deal-status{width:100%}.deal-metrics{grid-template-columns:1fr 1fr}.deal-side{grid-template-columns:1fr}.deal-attention{align-items:start}.deal-spine-card{padding:15px}.deal-spine li{grid-template-columns:32px minmax(0,1fr)}.deal-spine em{display:none}}
  @media(max-width:390px){.deal-metrics{grid-template-columns:1fr}.deal-hero{border-radius:23px}.deal-hero h1{font-size:38px}}
`;
