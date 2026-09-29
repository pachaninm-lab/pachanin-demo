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
import { Button, InlineNotice, NextActionCard, StatusChip, Surface } from '@pc/design-system-v8';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { DealCommandForm } from '@/components/platform-v7/DealCommandForm';
import { applyCsrfHeader } from '@/lib/csrf';
import styles from './TransactionDealWorkspace.module.css';

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
  commandId?: string;
  dealId?: string;
  actionId?: string;
  duplicate?: boolean;
  status?: string;
  updatedAt?: string;
  message?: string;
};

class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly field?: string, readonly code?: string, readonly structured = false) {
    super(message);
  }
}

function readError(payload: any, status: number): HttpError {
  const message = Array.isArray(payload?.message)
    ? payload.message.join(' · ')
    : payload?.message || payload?.error || `Ошибка ${status}`;
  return new HttpError(
    typeof message === 'string' ? message : JSON.stringify(message),
    status,
    typeof payload?.field === 'string' ? payload.field : undefined,
    typeof payload?.code === 'string' ? payload.code : undefined,
    Boolean(payload && typeof payload === 'object' && !Array.isArray(payload) &&
      (typeof payload.message === 'string' || typeof payload.error === 'string' ||
        (Array.isArray(payload.message) && payload.message.length > 0 && payload.message.every((item: unknown) => typeof item === 'string')))),
  );
}

async function readJson(response: Response): Promise<any> {
  const payload = await response.json().catch(() => { throw new HttpError('RESPONSE_UNVERIFIABLE', 502); });
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

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидается',
  WAITING: 'Ожидается',
  CREATED: 'Создано',
  RESERVED: 'Деньги зарезервированы',
  HOLD: 'Деньги удерживаются',
  CONFIRMED: 'Подтверждено',
  COMPLETED: 'Завершено',
  CLOSED: 'Закрыто',
  SIGNED: 'Подписано',
  IN_TRANSIT: 'В пути',
  ARRIVED: 'Прибыл',
  ACCEPTED: 'Принято',
  REJECTED: 'Отклонено',
  PASSED: 'Соответствует',
  FAILED: 'Не соответствует',
  OPEN: 'Открыто',
  NOT_STARTED: 'Не начато',
};

function humanStatus(value: string | null | undefined, emptyLabel = 'Нет данных'): string {
  if (!value) return emptyLabel;
  return STATUS_LABELS[value] || value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function waitingLabel(action: Workspace['roleProjection']['primaryAction']): string {
  if (!action) return '';
  if (action.source === 'BANK_CALLBACK' || action.waitingForRoles.includes('BANK_CALLBACK')) return 'подтверждение банка';
  if (action.waitingForRoles.length === 0) return 'другой участник сделки';
  return action.waitingForRoles.map((role) => humanStatus(role)).join(', ');
}

function stepStateLabel(state: SpineState): string {
  if (state === 'done') return 'Готово';
  if (state === 'active') return 'Сейчас';
  return 'Позже';
}

function matchingDocument(workspace: Workspace, patterns: RegExp[]): Workspace['documents'][number] | undefined {
  return workspace.documents.find((document) => {
    const searchable = `${document.type} ${document.name}`;
    return patterns.some((pattern) => pattern.test(searchable));
  });
}

function commandInitialValues(actionId: string, workspace: Workspace): Record<string, string> {
  const values: Record<string, string> = {};
  const shipmentId = workspace.shipments[0]?.id;
  const acceptanceId = workspace.acceptance[0]?.id;

  if (['confirm_loading', 'start_transit', 'confirm_arrival', 'confirm_weight'].includes(actionId) && shipmentId) {
    values.shipmentId = shipmentId;
  }
  if (actionId === 'accept_delivery' && acceptanceId) values.acceptanceId = acceptanceId;

  if (actionId === 'seller_sign_contract' || actionId === 'buyer_sign_contract') {
    const contract = matchingDocument(workspace, [/contract/i, /договор/i]);
    if (contract) values.documentId = contract.id;
  }

  if (actionId === 'confirm_inspection') {
    const inspection = matchingDocument(workspace, [/inspection/i, /survey/i, /осмотр/i, /заключен/i]);
    if (inspection) values.documentId = inspection.id;
  }

  return values;
}

function taskOwner(
  role: PlatformRole,
  action: Workspace['roleProjection']['primaryAction'],
  systemAction: boolean,
  hasBlockers: boolean,
): string {
  if (systemAction) return 'Банк';
  if (hasBlockers || action?.enabled) return roleLabel(role);
  return action ? waitingLabel(action) : 'Система сделки';
}

export function TransactionDealWorkspace({ role, dealId }: { role: PlatformRole; dealId: string }) {
  const [workspaceState, setWorkspace] = React.useState<Workspace | null>(null);
  const [workspaceContext, setWorkspaceContext] = React.useState({ dealId, role });
  const workspace = workspaceContext.dealId === dealId && workspaceContext.role === role ? workspaceState : null;
  const latestWorkspace = React.useRef(workspace);
  latestWorkspace.current = workspace;
  const reading = React.useRef(false);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const unresolved = React.useRef(new Map<string, { commandId: string; actionId: string; idempotencyKey: string }>());
  const inFlight = React.useRef(false);
  const readGeneration = React.useRef(0);
  const context = React.useRef({ dealId, role });
  context.current = { dealId, role };
  const mounted = React.useRef(true);
  const [, refreshAttempt] = React.useReducer((value: number) => value + 1, 0);
  const unknownAttempt = unresolved.current.get(dealId);
  const [locale, setLocale] = React.useState<'ru' | 'en' | 'zh'>('ru');
  const copy = locale === 'en' ? RECOVERY_EN : locale === 'zh' ? RECOVERY_ZH : RECOVERY_RU;
  const errorCopy = error === 'INPUT_PROBLEM' ? copy.inputError : error === 'REJECTED' ? copy.rejected : copy.readError;
  const noticeCopy = notice === 'DUPLICATE' ? copy.duplicate : notice === 'CONFLICT' ? copy.conflict : copy.success;

  React.useEffect(() => {
    mounted.current = true;
    const updateLocale = () => {
      const language = document.documentElement.lang.trim().toLowerCase().split(/[-_]/)[0];
      setLocale(language === 'en' || language === 'zh' ? language : 'ru');
    };
    updateLocale();
    const observer = new MutationObserver(updateLocale);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => { mounted.current = false; readGeneration.current += 1; observer.disconnect(); };
  }, []);

  const load = React.useCallback(async () => {
    if (!mounted.current || context.current.dealId !== dealId || context.current.role !== role) return;
    const generation = ++readGeneration.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const current = () => mounted.current && readGeneration.current === generation &&
      context.current.dealId === dealId && context.current.role === role;
    reading.current = true;
    setLoading(true);
    setError('');
    try {
      if (!dealId) throw new HttpError('DEAL_ID_REQUIRED', 400);
      const response = await fetch(`/api/proxy/deals/${encodeURIComponent(dealId)}/execution-workspace`, {
        method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal,
      });
      const payload = await readJson(response) as Workspace;
      if (payload?.deal?.id !== dealId || !payload.roleProjection ||
          typeof payload.roleProjection.canAct !== 'boolean' ||
          ![payload.blockers, payload.spine, payload.shipments, payload.documents, payload.laboratory,
            payload.acceptance, payload.disputes, payload.timeline].every(Array.isArray)) {
        throw new HttpError('DEAL_STATE_UNVERIFIABLE', 502);
      }
      // The read model does not expose a command receipt; aggregate changes cannot settle UNKNOWN.
      if (current()) { setWorkspaceContext({ dealId, role }); setWorkspace(payload); }
    } catch {
      if (current()) { setWorkspace(null); setError('READ_UNAVAILABLE'); }
    } finally {
      clearTimeout(timeout);
      if (current()) { reading.current = false; setLoading(false); }
    }
  }, [dealId, role]);

  React.useEffect(() => {
    setNotice('');
    void load();
    return () => { readGeneration.current += 1; };
  }, [load]);

  async function executePrimaryAction(payload: Record<string, unknown>) {
    const action = workspace?.roleProjection.primaryAction;
    const isSystemAction = action?.source === 'BANK_CALLBACK' || action?.waitingForRoles.includes('BANK_CALLBACK');
    if (!mounted.current || context.current.dealId !== dealId || context.current.role !== role ||
        !workspace || workspace !== latestWorkspace.current || workspace.deal.id !== dealId || workspace.roleProjection.canAct !== true ||
        action?.enabled !== true || isSystemAction || submitting || inFlight.current ||
        unresolved.current.has(dealId) || loading || reading.current || workspace.blockers.length > 0) return;

    const commandId = globalThis.crypto?.randomUUID?.() ?? `command-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const idempotencyKey = `${workspace.deal.id}:${action.id}:${commandId}`;
    let body: string;
    let headers: Headers;
    try {
      body = JSON.stringify({ commandId, idempotencyKey,
        expectedUpdatedAt: workspace.deal.updatedAt,
        expectedVersion: workspace.deal.version,
        payload,
      });
      headers = applyCsrfHeader({ 'Content-Type': 'application/json', Accept: 'application/json' });
    } catch {
      setError('INPUT_PROBLEM');
      return;
    }
    const current = () => mounted.current && context.current.dealId === dealId && context.current.role === role;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    inFlight.current = true;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/proxy/deals/${encodeURIComponent(workspace.deal.id)}/commands/${encodeURIComponent(action.id)}`, {
        method: 'POST', headers, cache: 'no-store', body, signal: controller.signal,
      });
      const result = await readJson(response) as CommandResult;
      // The server fingerprints idempotencyKey. Verify canonical attempt/deal/action identity instead.
      if (result?.ok !== true || result.commandId !== commandId || result.dealId !== dealId || result.actionId !== action.id) {
        throw new HttpError('COMMAND_RECEIPT_UNVERIFIABLE', 502);
      }
      unresolved.current.delete(dealId);
      if (current()) { setNotice(result.duplicate ? 'DUPLICATE' : 'CONFIRMED'); await load(); }
    } catch (reason) {
      const conflict = reason instanceof HttpError && reason.status === 409 && reason.structured &&
        ['DEAL_STATE_CONFLICT', 'STALE_DEAL_VERSION', 'CONCURRENT_DEAL_UPDATE'].includes(reason.code || '');
      const rejected = reason instanceof HttpError && reason.structured && [400, 401, 403, 404, 422].includes(reason.status);
      if (conflict || rejected) {
        unresolved.current.delete(dealId);
        if (current()) {
          if (conflict) { setNotice('CONFLICT'); await load(); }
          else setError('REJECTED');
        }
      } else {
        unresolved.current.set(dealId, { commandId, actionId: action.id, idempotencyKey });
        if (current()) { setError(''); setNotice(''); }
      }
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
      if (mounted.current) { setSubmitting(false); refreshAttempt(); }
    }
  }

  const unknownNotice = unknownAttempt ? (
    <InlineNotice tone='critical' title={copy.unknownTitle} role='alert' data-command-outcome='UNKNOWN'>
      <span>{copy.unknownBody}</span>{' '}
      <span>{copy.attempt}: <code translate='no'>{unknownAttempt.commandId}</code>.</span>{' '}
      <span>{copy.readHint}</span>
    </InlineNotice>
  ) : null;

  if (loading && !workspace) {
    return (
      <Surface className={styles.stateSurface} aria-live='polite'>
        <div className={styles.stateContent}>
          <Loader2 size={26} className={styles.spin} aria-hidden='true' />
          <h1>{copy.openTitle}</h1>
          <p>{copy.openBody}</p>
          {unknownNotice}
        </div>
      </Surface>
    );
  }

  if (!workspace) {
    return (
      <Surface className={styles.stateSurface} role='alert'>
        <div className={styles.stateContent}>
          <AlertTriangle size={28} aria-hidden='true' />
          <h1>{copy.unavailable}</h1>
          <p>{errorCopy}</p>
          {unknownNotice}
          <Button variant='secondary' onClick={() => void load()} disabled={loading || submitting}>
            <RefreshCw size={18} aria-hidden='true' /> {copy.reload}
          </Button>
        </div>
      </Surface>
    );
  }

  const activeStep = workspace.spine.find((step) => step.state === 'active');
  const action = workspace.roleProjection.primaryAction;
  const systemAction = action?.source === 'BANK_CALLBACK' || action?.waitingForRoles.includes('BANK_CALLBACK');
  const shipment = workspace.shipments[0];
  const acceptance = workspace.acceptance[0];
  const signedDocuments = workspace.documents.filter((item) => item.status === 'SIGNED').length;
  const hasBlockers = workspace.blockers.length > 0;

  const taskTitle = hasBlockers
    ? workspace.blockers[0]
    : systemAction
      ? 'Жди подтверждение банка'
      : action?.enabled
        ? action.label
        : action
          ? `Жди: ${waitingLabel(action)}`
          : 'Сейчас ничего делать не нужно';

  const taskExplanation = hasBlockers
    ? 'Сначала устрани указанный стоп-фактор. До этого следующий шаг сделки заблокирован.'
    : systemAction
      ? 'Банк проверяет операцию. Состояние изменится автоматически после подтверждённого callback.'
      : action?.enabled
        ? workspace.attention || 'Заполни только обязательные поля и подтверди действие.'
        : action
          ? `Следующий шаг выполняет ${waitingLabel(action)}. Экран обновится после подтверждения.`
          : 'Сделка завершена или ожидает системного события.';

  const TaskIcon = hasBlockers ? AlertTriangle : systemAction ? Banknote : ArrowRight;
  const actionExtras = (
    <div className={styles.actionExtras}>
      {hasBlockers && workspace.blockers.length > 1 ? (
        <ul className={styles.blockerList}>
          {workspace.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
        </ul>
      ) : null}

      {!hasBlockers && systemAction ? <p className={styles.systemNote}>Ручное подтверждение невозможно.</p> : null}

      {!hasBlockers && action?.enabled && !systemAction ? (
        <DealCommandForm
          actionId={action.id}
          label={action.label}
          submitting={submitting}
          disabled={loading || submitting || Boolean(unknownAttempt) || workspace.roleProjection.canAct !== true}
          initialValues={commandInitialValues(action.id, workspace)}
          onSubmit={executePrimaryAction}
        />
      ) : null}
    </div>
  );

  return (
    <section className={styles.workspace} data-canonical-deal={workspace.deal.id} data-role={role} data-transaction-workspace='v8'>
      <Surface className={styles.summary} padded={false}>
        <div className={styles.summaryTop}>
          <div className={styles.summaryIdentity}>
            <span className={styles.eyebrow}><Wheat size={18} aria-hidden='true' /> Сделка</span>
            <h1>{workspace.deal.number || workspace.deal.id}</h1>
            <p className={styles.summarySubtitle}>
              {workspace.deal.culture || 'Зерно'}
              {workspace.deal.cropClass ? ` · ${workspace.deal.cropClass} класс` : ''}
              {' · '}{formatDecimal(workspace.deal.volumeTons, 'т')}
            </p>
          </div>
          <div className={styles.stageBlock} title={workspace.deal.status}>
            <StatusChip tone='information'>Сейчас: {activeStep?.stage || humanStatus(workspace.deal.status)}</StatusChip>
          </div>
        </div>
        <div className={styles.roleLine}>
          <span className={styles.roleIdentity}><ShieldCheck size={18} aria-hidden='true' />{roleLabel(role)}</span>
          <strong className={styles.roleFocus}>{workspace.roleProjection.focus}</strong>
          <Button className={styles.refreshButton} variant='secondary' onClick={() => void load()} aria-label={copy.reload} disabled={loading || submitting}>
            <RefreshCw size={18} className={loading ? styles.spin : undefined} aria-hidden='true' />
          </Button>
        </div>
      </Surface>

      <NextActionCard
        action={taskTitle}
        reason={taskExplanation}
        label={hasBlockers ? 'Сначала реши проблему' : systemAction ? 'Сейчас делать ничего не нужно' : 'Твоё следующее действие'}
        icon={<TaskIcon size={25} />}
        blocked={hasBlockers}
        impact={`Сумма сделки: ${formatMoney(workspace.deal.totalKopecks, workspace.deal.currency)}`}
        owner={taskOwner(role, action, systemAction, hasBlockers)}
        actions={actionExtras}
      />

      {error || notice || unknownAttempt ? (
        <div className={styles.messages}>
          {unknownNotice}
          {error ? <InlineNotice tone='critical' icon={<AlertTriangle size={19} />} title={error === 'INPUT_PROBLEM' ? copy.inputTitle : error === 'REJECTED' ? copy.rejectedTitle : copy.readTitle} role='alert'>{errorCopy}</InlineNotice> : null}
          {notice ? <InlineNotice tone={notice === 'CONFLICT' ? 'warning' : 'success'} icon={<CheckCircle2 size={19} />} title={notice === 'CONFLICT' ? copy.conflictTitle : copy.receiptTitle} role='status'>{noticeCopy}</InlineNotice> : null}
        </div>
      ) : null}

      <section className={styles.metrics} aria-label='Главные факты сделки'>
        <article className={styles.metric}>
          <Banknote size={20} aria-hidden='true' />
          <span className={styles.metricCopy}><small className={styles.metricLabel}>Сумма</small><strong className={styles.metricValue}>{formatMoney(workspace.deal.totalKopecks, workspace.deal.currency)}</strong></span>
        </article>
        <article className={styles.metric} title={workspace.money?.status || undefined}>
          <ShieldCheck size={20} aria-hidden='true' />
          <span className={styles.metricCopy}><small className={styles.metricLabel}>Деньги</small><strong className={styles.metricValue}>{humanStatus(workspace.money?.status, 'Ожидаются')}</strong></span>
        </article>
        <article className={styles.metric} title={shipment?.status}>
          <Truck size={20} aria-hidden='true' />
          <span className={styles.metricCopy}><small className={styles.metricLabel}>Рейс</small><strong className={styles.metricValue}>{humanStatus(shipment?.status, 'Не назначен')}</strong></span>
        </article>
        <article className={styles.metric}>
          <FileCheck2 size={20} aria-hidden='true' />
          <span className={styles.metricCopy}><small className={styles.metricLabel}>Документы</small><strong className={styles.metricValue}>{workspace.documents.length === 0 ? 'Пока нет' : `${signedDocuments} из ${workspace.documents.length} подписано`}</strong></span>
        </article>
      </section>

      <details className={styles.details}>
        <summary>Показать весь путь сделки</summary>
        <div className={styles.detailsBody}>
          <ol className={styles.spine}>
            {workspace.spine.map((step) => (
              <li
                key={step.id}
                className={`${styles.spineItem} ${step.state === 'done' ? styles.spineItemDone : ''} ${step.state === 'active' ? styles.spineItemActive : ''}`}
              >
                <span className={styles.stepMarker}>
                  {step.state === 'done' ? <Check size={16} aria-hidden='true' /> : step.state === 'active' ? <Clock3 size={16} aria-hidden='true' /> : null}
                </span>
                <span className={styles.stepCopy}><small>{step.stage}</small><strong>{step.label}</strong></span>
                <span className={styles.stepState}>{stepStateLabel(step.state)}</span>
              </li>
            ))}
          </ol>
        </div>
      </details>

      <details className={styles.details}>
        <summary>Факты и доказательства</summary>
        <div className={styles.detailsBody}>
          <dl className={styles.factGrid}>
            <div className={styles.factRow}><dt>Цена</dt><dd>{formatDecimal(workspace.deal.pricePerTon, '₽/т')}</dd></div>
            <div className={styles.factRow}><dt>Вес приёмки</dt><dd>{formatDecimal(acceptance?.weightActualTons, 'т')}</dd></div>
            <div className={styles.factRow}><dt>Качество</dt><dd>{humanStatus(acceptance?.qualityStatus, 'Не проверено')}</dd></div>
            <div className={styles.factRow}><dt>Лаборатория</dt><dd>{workspace.laboratory.length ? humanStatus(workspace.laboratory[0].status) : 'Нет результата'}</dd></div>
            <div className={styles.factRow}><dt>События</dt><dd>{workspace.timeline.length}</dd></div>
            <div className={styles.factRow}><dt>Споры</dt><dd>{workspace.disputes.length || 'Нет'}</dd></div>
          </dl>
        </div>
      </details>
    </section>
  );
}

const RECOVERY_RU = {
  unknownTitle: 'Результат действия неизвестен',
  unknownBody: 'Сервер мог принять действие, но подтверждение не получено. Повторная отправка заблокирована.',
  attempt: 'Идентификатор попытки',
  readHint: 'Обновление только читает состояние сделки. Оно не повторяет команду и не подтверждает эту попытку по изменению статуса.',
  reload: 'Повторить загрузку сделки',
  readTitle: 'Состояние сделки недоступно',
  readError: 'Не удалось получить подтверждённое состояние сделки. Повтори чтение; новая команда не отправляется.',
  inputTitle: 'Проверь данные действия',
  inputError: 'Запрос не удалось подготовить. Исправь данные перед отправкой.',
  rejectedTitle: 'Сервер отклонил действие',
  rejected: 'Проверь доступ и данные действия. Выполнение не подтверждено.',
  receiptTitle: 'Ответ сервера подтверждён',
  success: 'Сервер подтвердил запись этой команды. Состояние сделки загружается отдельно.',
  duplicate: 'Сервер вернул сохранённый результат этой же команды. Повторного выполнения не было.',
  conflictTitle: 'Действие требует проверки',
  conflict: 'Данные изменились другим участником. Перед новой попыткой проверь актуальное состояние сделки.',
  openTitle: 'Открываем сделку',
  openBody: 'Сейчас покажем только твой следующий шаг.',
  unavailable: 'Рабочая сделка недоступна',
} as const;

const RECOVERY_EN = {
  unknownTitle: 'The action outcome is unknown',
  unknownBody: 'The server may have accepted the action, but no matching confirmation was received. Sending it again is blocked.',
  attempt: 'Attempt ID',
  readHint: 'Refresh only reads the deal. It does not resend the command, and a changed status does not confirm this attempt.',
  reload: 'Reload deal state',
  readTitle: 'Deal state is unavailable',
  readError: 'Verified deal state could not be loaded. Retry the read; no new command is sent.',
  inputTitle: 'Check the action details',
  inputError: 'The request could not be prepared. Correct the details before sending it.',
  rejectedTitle: 'The server rejected the action',
  rejected: 'Check your access and action details. Execution has not been confirmed.',
  receiptTitle: 'Server response verified',
  success: 'The server confirmed this command record. Deal state is loaded separately.',
  duplicate: 'The server returned the saved result of this same command. It was not executed again.',
  conflictTitle: 'Check the action before retrying',
  conflict: 'Another participant changed the data. Review current deal state before a new attempt.',
  openTitle: 'Opening the deal',
  openBody: 'Your next step will appear here.',
  unavailable: 'This deal is currently unavailable',
} as const;

const RECOVERY_ZH = {
  unknownTitle: '操作结果未知',
  unknownBody: '服务器可能已接受该操作，但尚未收到与本次尝试匹配的确认。已禁止重复提交。',
  attempt: '尝试标识',
  readHint: '刷新仅查询交易状态，不会重新提交操作。交易状态发生变化并不代表本次尝试已得到确认。',
  reload: '重新读取交易状态',
  readTitle: '交易状态不可用',
  readError: '无法读取已验证的交易状态。请重试查询；不会发送新的操作。',
  inputTitle: '请检查操作信息',
  inputError: '无法准备请求。请在提交前修正操作信息。',
  rejectedTitle: '服务器拒绝了该操作',
  rejected: '请检查权限和操作信息。尚未确认操作已执行。',
  receiptTitle: '已验证服务器回复',
  success: '服务器已确认本次操作记录。交易状态将单独读取。',
  duplicate: '服务器返回了同一操作的已保存结果，没有再次执行。',
  conflictTitle: '重试前请核对操作',
  conflict: '其他参与者已更新数据。请在再次尝试前核对最新交易状态。',
  openTitle: '正在打开交易',
  openBody: '即将显示你的下一步操作。',
  unavailable: '当前无法访问此交易',
} as const;
