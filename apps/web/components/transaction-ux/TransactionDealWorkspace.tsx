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
  return new HttpError(
    typeof message === 'string' ? message : JSON.stringify(message),
    status,
    typeof payload?.field === 'string' ? payload.field : undefined,
  );
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
      setNotice(result.duplicate ? 'Это действие уже было выполнено. Показан сохранённый результат.' : 'Готово. Результат записан в сделку.');
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
    return (
      <Surface className={styles.stateSurface} aria-live='polite'>
        <div className={styles.stateContent}>
          <Loader2 size={26} className={styles.spin} aria-hidden='true' />
          <h1>Открываем сделку</h1>
          <p>Сейчас покажем только твой следующий шаг.</p>
        </div>
      </Surface>
    );
  }

  if (!workspace) {
    return (
      <Surface className={styles.stateSurface} role='alert'>
        <div className={styles.stateContent}>
          <AlertTriangle size={28} aria-hidden='true' />
          <h1>Рабочая сделка недоступна</h1>
          <p>{error || 'Сервер не вернул подтверждённое состояние.'}</p>
          <Button variant='secondary' onClick={() => void load()}>
            <RefreshCw size={18} aria-hidden='true' /> Повторить
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
          disabled={false}
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
          <Button className={styles.refreshButton} variant='secondary' onClick={() => void load()} aria-label='Обновить сделку' disabled={loading}>
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

      {error || notice ? (
        <div className={styles.messages}>
          {error ? <InlineNotice tone='critical' icon={<AlertTriangle size={19} />} title='Действие не выполнено'>{error}</InlineNotice> : null}
          {notice ? <InlineNotice tone='success' icon={<CheckCircle2 size={19} />} title='Состояние сделки обновлено'>{notice}</InlineNotice> : null}
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
