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
import { DealCommandForm } from '@/components/platform-v7/DealCommandForm';

type SpineState = 'done' | 'active' | 'pending';
type ActionSource = 'USER' | 'BANK_CALLBACK';

type Workspace = {
  deal: {
    id: string;
    number: string | null;
    status: string;
    version: string;
    updatedAt: string;
    culture: string | null;
    cropClass: string | null;
    volumeTons: string | null;
    pricePerTon: string | null;
    totalKopecks: string | null;
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
    amountKopecks: string | null;
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
  acceptance: Array<{ id: string; status: string; weightActualTons?: string | null; qualityStatus: string; notes?: string | null }>;
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

class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly field?: string) {
    super(message);
  }
}

function readError(payload: any, status: number): HttpError {
  const message = Array.isArray(payload?.message)
    ? payload.message.join(' · ')
    : payload?.message || payload?.error || `Ошибка ${status}`;
  return new HttpError(typeof message === 'string' ? message : JSON.stringify(message), status, typeof payload?.field === 'string' ? payload.field : undefined);
}

async function readJson(response: Response): Promise<any> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw readError(payload, response.status);
  return payload;
}

function formatMoney(kopecks: string | null | undefined, currency = 'RUB'): string {
  if (!kopecks || !/^-?\d+$/.test(kopecks)) return '—';
  const negative = kopecks.startsWith('-');
  const digits = negative ? kopecks.slice(1) : kopecks;
  const rubles = digits.length > 2 ? digits.slice(0, -2) : '0';
  const cents = digits.slice(-2).padStart(2, '0');
  const grouped = rubles.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const symbol = currency === 'RUB' ? '₽' : currency;
  return `${negative ? '−' : ''}${grouped},${cents} ${symbol}`;
}

function formatDecimal(value: string | null | undefined, suffix: string): string {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return '—';
  const [whole, fraction = ''] = value.split('.');
  const significant = fraction.replace(/0+$/, '').slice(0, 6);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped}${significant ? `,${significant}` : ''} ${suffix}`;
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

function waitingLabel(action: Workspace['roleProjection']['primaryAction']): string {
  if (!action) return '';
  if (action.source === 'BANK_CALLBACK' || action.waitingForRoles.includes('BANK_CALLBACK')) return 'подтверждённый callback банка';
  return action.waitingForRoles.join(', ');
}

export function CanonicalDealWorkspace({ role, dealId }: { role: PlatformRole; dealId: string }) {
  const [workspace, setWorkspace] = React.useState<Workspace | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');

  const load = React.useCallback(async () => {
    if (!dealId) {
      setWorkspace(null);
      setLoading(false);
      setError('Рабочее место нельзя открыть без подтверждённого идентификатора сделки.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/proxy/deals/${encodeURIComponent(dealId)}/execution-workspace`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const payload = await readJson(response) as Workspace;
      if (!payload?.deal?.id || payload.deal.id !== dealId) throw new HttpError('Сервер вернул состояние другой сделки.', 502);
      setWorkspace(payload);
    } catch (reason) {
      setWorkspace(null);
      setError(reason instanceof Error ? reason.message : 'Не удалось загрузить сделку.');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function executePrimaryAction(payload: Record<string, unknown>) {
    const action = workspace?.roleProjection.primaryAction;
    const isSystemAction = action?.source === 'BANK_CALLBACK' || action?.waitingForRoles.includes('BANK_CALLBACK');
    if (!workspace || !action?.enabled || isSystemAction || submitting || workspace.blockers.length > 0) return;

    const commandId = globalThis.crypto?.randomUUID?.() ?? `command-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const idempotencyKey = `${workspace.deal.id}:${action.id}:${commandId}`;
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/proxy/deals/${encodeURIComponent(workspace.deal.id)}/commands/${encodeURIComponent(action.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          commandId,
          idempotencyKey,
          expectedUpdatedAt: workspace.deal.updatedAt,
          expectedVersion: workspace.deal.version,
          payload,
        }),
      });
      const result = await readJson(response) as CommandResult;
      setNotice(result.duplicate ? 'Команда уже была принята ранее. Показан сохранённый результат.' : 'Действие подтверждено сервером и записано в журнал сделки.');
      await load();
    } catch (reason) {
      if (reason instanceof HttpError && reason.status === 409) {
        setNotice('Данные изменились другим участником. Экран обновлён — проверь состояние и повтори действие.');
        await load();
      } else if (reason instanceof TypeError) {
        setError('Нет связи. Действие не отправлено и не сохранено на устройстве. Проверь данные и повтори после восстановления сети.');
      } else {
        const field = reason instanceof HttpError && reason.field ? `Поле «${reason.field}»: ` : '';
        setError(`${field}${reason instanceof Error ? reason.message : 'Команда не выполнена.'}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !workspace) {
    return <section className='deal-loading' aria-live='polite'><Loader2 size={24} className='spin' /><strong>Загружаем сделку…</strong><style jsx>{styles}</style></section>;
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
          <span className='deal-kicker'><Wheat size={16} /> Сквозная сделка</span>
          <h1>{workspace.deal.number || workspace.deal.id}</h1>
          <p>{workspace.deal.culture || 'Зерно'}{workspace.deal.cropClass ? ` · ${workspace.deal.cropClass} класс` : ''} · {formatDecimal(workspace.deal.volumeTons, 'т')}</p>
        </div>
        <div className='deal-status'><small>Текущий этап</small><strong>{activeStep?.stage || (workspace.deal.status === 'CLOSED' ? 'Закрыто' : workspace.deal.status)}</strong><span>{workspace.deal.status}</span></div>
      </header>

      <div className='deal-role-strip'><span><ShieldCheck size={17} />{roleLabel(role)}</span><strong>{workspace.roleProjection.focus}</strong></div>

      <section className={`deal-attention ${workspace.blockers.length ? 'blocked' : ''}`}>
        <div className='attention-icon'>{workspace.blockers.length ? <AlertTriangle size={23} /> : systemAction ? <Banknote size={23} /> : <ArrowRight size={23} />}</div>
        <div><small>{workspace.blockers.length ? 'Стоп-фактор' : systemAction ? 'Ожидаем внешнее подтверждение' : 'Что происходит сейчас'}</small><h2>{workspace.blockers[0] || (systemAction ? 'Банк обрабатывает операцию' : workspace.attention)}</h2>{action && !action.enabled ? <p>Следующий подтверждённый шаг выполняет: {waitingLabel(action)}.</p> : null}</div>
      </section>

      {error ? <p className='deal-message error' role='alert'>{error}</p> : null}
      {notice ? <p className='deal-message success' role='status'><CheckCircle2 size={17} />{notice}</p> : null}

      <div className='deal-metrics'>
        <article><Banknote size={18} /><span><small>Сумма сделки</small><strong>{formatMoney(workspace.deal.totalKopecks, workspace.deal.currency)}</strong></span></article>
        <article><ShieldCheck size={18} /><span><small>Деньги</small><strong>{workspace.money?.status || 'PENDING'}</strong></span></article>
        <article><Truck size={18} /><span><small>Рейс</small><strong>{shipment?.status || 'Не назначен'}</strong></span></article>
        <article><FileCheck2 size={18} /><span><small>Документы</small><strong>{workspace.documents.filter((item) => item.status === 'SIGNED').length}/{workspace.documents.length} подписано</strong></span></article>
      </div>

      <div className='deal-grid'>
        <section className='deal-spine-card'>
          <div className='section-heading'><div><span>Линия сделки</span><h2>Один путь для всех ролей</h2></div><button type='button' onClick={() => void load()} aria-label='Обновить сделку' disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button></div>
          <ol className='deal-spine'>{workspace.spine.map((step) => <li key={step.id} className={step.state}><span className='step-marker'>{step.state === 'done' ? <Check size={15} /> : step.state === 'active' ? <Clock3 size={15} /> : null}</span><div><small>{step.stage}</small><strong>{step.label}</strong></div><em>{step.state === 'done' ? 'Сделано' : step.state === 'active' ? 'Сейчас' : 'Далее'}</em></li>)}</ol>
        </section>

        <aside className='deal-side'>
          <section className='deal-action-card'>
            <small>{systemAction ? 'Системное событие' : 'Твоё следующее действие'}</small>
            <h2>{systemAction ? 'Ожидаем подтверждение банка' : action?.label || 'Действий нет'}</h2>
            {systemAction ? <p>Состояние изменится только после проверки подписанного банковского callback. Ручное подтверждение невозможно.</p> : action ? action.enabled ? <DealCommandForm actionId={action.id} label={action.label} submitting={submitting} disabled={workspace.blockers.length > 0} onSubmit={executePrimaryAction} /> : <p>Сейчас действие недоступно этой роли.</p> : <p>Сделка завершена или ожидает системного события.</p>}
          </section>

          <section className='deal-facts-card'><h3>Факты сделки</h3><dl><div><dt>Цена</dt><dd>{formatDecimal(workspace.deal.pricePerTon, '₽/т')}</dd></div><div><dt>Вес приёмки</dt><dd>{formatDecimal(acceptance?.weightActualTons, 'т')}</dd></div><div><dt>Качество</dt><dd>{acceptance?.qualityStatus || 'Не проверено'}</dd></div><div><dt>События</dt><dd>{workspace.timeline.length}</dd></div><div><dt>Споры</dt><dd>{workspace.disputes.length}</dd></div></dl></section>
        </aside>
      </div>
      <style jsx>{styles}</style>
    </section>
  );
}

const styles = `
  .deal-workspace{display:grid;gap:14px;color:var(--pc-text-primary)}.deal-loading,.deal-error{min-height:220px;border:1px solid var(--pc-border);background:var(--pc-shell-surface);border-radius:24px;display:flex;align-items:center;justify-content:center;gap:12px;padding:24px;color:var(--pc-text-secondary)}.deal-error{justify-content:flex-start;flex-wrap:wrap}.deal-error>svg{color:#c2413c}.deal-error div{flex:1;min-width:200px}.deal-error p{margin:4px 0 0}.deal-error button{border:1px solid var(--pc-border);background:var(--pc-shell-surface-soft);color:var(--pc-text-primary);border-radius:13px;min-height:44px;padding:0 14px;display:inline-flex;align-items:center;gap:7px;font-weight:850}
  .deal-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:clamp(20px,4vw,34px);border-radius:28px;background:linear-gradient(135deg,#092d20 0%,#0b5a38 66%,#0a7543 100%);color:#fff;box-shadow:0 24px 55px rgba(8,65,40,.18);overflow:hidden;position:relative}.deal-hero:after{content:"";position:absolute;width:260px;height:260px;border-radius:50%;right:-90px;top:-150px;border:42px solid rgba(255,255,255,.07)}.deal-kicker{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:#bce4cb}.deal-hero h1{margin:10px 0 5px;font-size:clamp(32px,7vw,64px);line-height:.95;letter-spacing:-.055em}.deal-hero p{margin:0;color:#d7ebdf;font-weight:700}.deal-status{position:relative;z-index:1;min-width:160px;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(12px)}.deal-status small,.deal-status span{display:block;color:#cbe6d5;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.06em}.deal-status strong{display:block;margin:5px 0;font-size:18px}
  .deal-role-strip{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 15px;border-radius:16px;background:var(--pc-shell-surface);border:1px solid var(--pc-border)}.deal-role-strip span{display:inline-flex;align-items:center;gap:7px;color:var(--pc-accent);font-size:12px;font-weight:900}.deal-role-strip strong{font-size:13px}.deal-attention{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:14px;padding:18px;border:1px solid rgba(8,122,59,.18);background:var(--pc-accent-bg);border-radius:22px}.deal-attention.blocked{border-color:rgba(194,65,60,.28);background:rgba(194,65,60,.07)}.attention-icon{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:var(--pc-shell-surface);color:var(--pc-accent)}.deal-attention small{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--pc-text-muted);font-weight:900}.deal-attention h2{margin:4px 0 0;font-size:clamp(17px,3vw,23px);line-height:1.2}.deal-attention p{margin:6px 0 0;color:var(--pc-text-secondary);font-size:12px}.deal-message{margin:0;padding:12px 14px;border-radius:14px;font-size:13px;font-weight:800;display:flex;gap:8px;align-items:center}.deal-message.error{background:#fff1f1;color:#9b2525;border:1px solid #f2c5c5}.deal-message.success{background:#edf8f1;color:#08683a;border:1px solid #c8e8d3}
  .deal-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.deal-metrics article{display:flex;align-items:center;gap:10px;padding:14px;border-radius:18px;background:var(--pc-shell-surface);border:1px solid var(--pc-border);min-width:0}.deal-metrics svg{color:var(--pc-accent);flex:0 0 auto}.deal-metrics span{display:grid;min-width:0}.deal-metrics small{font-size:10px;color:var(--pc-text-muted);font-weight:850;text-transform:uppercase}.deal-metrics strong{margin-top:3px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.deal-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:14px;align-items:start}.deal-spine-card,.deal-action-card,.deal-facts-card{border:1px solid var(--pc-border);background:var(--pc-shell-surface);border-radius:24px;box-shadow:var(--pc-shadow-xs)}.deal-spine-card{padding:18px}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.section-heading span,.deal-action-card>small{font-size:10px;color:var(--pc-accent);font-weight:900;text-transform:uppercase;letter-spacing:.07em}.section-heading h2{margin:3px 0 0;font-size:20px}.section-heading button{width:44px;height:44px;border-radius:13px;border:1px solid var(--pc-border);background:var(--pc-shell-surface-soft);color:var(--pc-text-secondary);display:grid;place-items:center}.deal-spine{list-style:none;margin:0;padding:0;display:grid}.deal-spine li{position:relative;display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:62px;padding:8px 0}.deal-spine li:not(:last-child):before{content:"";position:absolute;left:15px;top:45px;bottom:-9px;width:2px;background:var(--pc-border)}.step-marker{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;border:2px solid var(--pc-border);background:var(--pc-shell-surface);z-index:1}.deal-spine li.done .step-marker{background:var(--pc-accent);border-color:var(--pc-accent);color:white}.deal-spine li.active .step-marker{border-color:var(--pc-accent);color:var(--pc-accent);box-shadow:0 0 0 5px var(--pc-accent-bg)}.deal-spine li.done:not(:last-child):before{background:var(--pc-accent)}.deal-spine li div{display:grid;gap:2px}.deal-spine small{font-size:10px;color:var(--pc-text-muted);font-weight:850;text-transform:uppercase}.deal-spine strong{font-size:13px}.deal-spine em{font-style:normal;font-size:10px;font-weight:900;color:var(--pc-text-muted)}.deal-side{display:grid;gap:14px}.deal-action-card{padding:20px}.deal-action-card h2{margin:9px 0 14px;font-size:22px;line-height:1.12}.deal-action-card>p{margin:0;color:var(--pc-text-secondary);font-size:12px;line-height:1.5}.deal-facts-card{padding:18px}.deal-facts-card h3{margin:0 0 10px;font-size:16px}.deal-facts-card dl{margin:0;display:grid}.deal-facts-card dl div{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--pc-border)}.deal-facts-card dt{color:var(--pc-text-muted);font-size:11px}.deal-facts-card dd{margin:0;text-align:right;font-size:12px;font-weight:850}.spin{animation:deal-spin .85s linear infinite}@keyframes deal-spin{to{transform:rotate(360deg)}}
  @media(max-width:800px){.deal-grid{grid-template-columns:1fr}.deal-side{order:-1}.deal-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.deal-hero{align-items:flex-start;flex-direction:column}.deal-status{width:100%}}
  @media(max-width:430px){.deal-workspace{gap:10px}.deal-hero{border-radius:22px;padding:20px}.deal-hero h1{font-size:34px;word-break:break-word}.deal-metrics{gap:8px}.deal-metrics article{padding:11px}.deal-spine-card,.deal-action-card,.deal-facts-card{border-radius:20px}.deal-action-card{padding:16px}.deal-spine-card{padding:14px}}
  @media(prefers-reduced-motion:reduce){.spin{animation:none}}@media(forced-colors:active){.deal-hero,.deal-status,.deal-attention,.deal-spine-card,.deal-action-card,.deal-facts-card{border:1px solid CanvasText}}
`;
