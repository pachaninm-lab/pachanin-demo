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
import { dealLocale, dealRoleText, dealServerText, dealText, type DealLocale } from '@/i18n/transaction-deal-copy';
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
  acceptance: Array<{ id: string; status: string; weightActualTons?: string | number | null; qualityStatus: string; notes?: string | null }>;
  disputes: Array<{ id: string; status: string; description: string }>;
  timeline: Array<{ id: string; eventType: string; createdAt: string; [key: string]: unknown }>;
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

// A persisted attempt is only a brake. It never grants a role, selects a tenant,
// replays a payload or establishes a business outcome. PostgreSQL remains authority.
type PendingAttempt = {
  schema: 1; dealId: string; commandId: string; actionId: string; idempotencyKey: string;
  fingerprint: string; expectedUpdatedAt: string; expectedVersion: string; fromStatus: string; actorRole: string;
};
const PENDING_FIELDS = ['schema', 'dealId', 'commandId', 'actionId', 'idempotencyKey',
  'fingerprint', 'expectedUpdatedAt', 'expectedVersion', 'fromStatus', 'actorRole'];
function pendingKey(dealId: string): string { return `pc:deal-command:pending:v1:${encodeURIComponent(dealId)}`; }
function readPending(dealId: string): PendingAttempt | null {
  const raw = window.localStorage.getItem(pendingKey(dealId));
  if (raw === null) return null;
  if (raw.length > 4096) throw new Error('PENDING_RECORD_INVALID');
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.schema !== 1 || value.dealId !== dealId ||
      Object.keys(value).length !== PENDING_FIELDS.length || !PENDING_FIELDS.every((key) => key in value) ||
      !PENDING_FIELDS.slice(1).every((key) => typeof value[key] === 'string' && value[key].length > 0 && value[key].length <= 1024) ||
      !/^fp:[a-f0-9]{64}$/.test(String(value.fingerprint)) || !/^\d+$/.test(String(value.expectedVersion)) ||
      !Number.isFinite(Date.parse(String(value.expectedUpdatedAt))) ||
      value.idempotencyKey !== `${dealId}:${value.actionId}:${value.commandId}`) throw new Error('PENDING_RECORD_INVALID');
  return value as PendingAttempt;
}
async function withPendingLock<T>(dealId: string, work: () => T): Promise<T> {
  if (!globalThis.navigator?.locks?.request) throw new Error('PENDING_LOCK_UNAVAILABLE');
  return navigator.locks.request(pendingKey(dealId), { mode: 'exclusive', ifAvailable: true }, (lock) => {
    if (!lock) throw new Error('PENDING_LOCK_BUSY');
    return work();
  });
}
function sameAttempt(left: PendingAttempt, right: PendingAttempt): boolean {
  return left.dealId === right.dealId && left.commandId === right.commandId &&
    left.actionId === right.actionId && left.fingerprint === right.fingerprint;
}
function clearPendingLocked(attempt: PendingAttempt): PendingAttempt | null {
  const stored = readPending(attempt.dealId);
  if (stored && !sameAttempt(stored, attempt)) return stored;
  if (stored) {
    window.localStorage.removeItem(pendingKey(attempt.dealId));
    if (readPending(attempt.dealId) !== null) throw new Error('PENDING_REMOVE_UNVERIFIABLE');
  }
  return null;
}
function stableMaterial(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableMaterial);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableMaterial(item)]));
  return value;
}
async function commandFingerprint(dealId: string, actionId: string, body: string): Promise<string> {
  // Same material as IndustrialDealCommandGateway.fingerprintedCommand; use the
  // serialized request, not a mutable form object or the server-normalized payload.
  const dto = JSON.parse(body);
  const material = { dealId, actionId, commandId: dto.commandId, clientIdempotencyKey: dto.idempotencyKey,
    expectedUpdatedAt: dto.expectedUpdatedAt, payload: dto.payload ?? {} };
  const bytes = new TextEncoder().encode(JSON.stringify(stableMaterial(material)));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `fp:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
function hasCommittedAttempt(workspace: Workspace, attempt: PendingAttempt): boolean {
  // The existing GET exposes full DealEvents. The command event and its outbox
  // receipt commit in ONE transaction; aggregate changes cannot settle UNKNOWN.
  const matches = workspace.timeline.filter((event) => isRecord(event.payload) && event.payload.commandId === attempt.commandId);
  if (matches.length !== 1) return false;
  const event = matches[0];
  const payload = event.payload;
  if (!isRecord(payload) || event.dealId !== attempt.dealId || event.eventType !== attempt.actionId.toUpperCase() ||
      event.actorRole !== attempt.actorRole || typeof event.actorId !== 'string' || !event.actorId ||
      typeof event.tenantId !== 'string' || !event.tenantId || typeof event.hash !== 'string' || !/^[a-f0-9]{64}$/.test(event.hash) ||
      payload.actionId !== attempt.actionId || payload.idempotencyKey !== attempt.fingerprint ||
      payload.from !== attempt.fromStatus || typeof payload.to !== 'string' || !payload.to || payload.to === payload.from ||
      typeof payload.resultingUpdatedAt !== 'string' || !/^\d+$/.test(workspace.deal.version)) return false;
  // The authorized GET already carries the producer's from/to transition in
  // buildDealSpine. Consume it rather than inventing a frontend lifecycle map.
  const transitions = workspace.spine.filter((step) => step.id === attempt.actionId);
  const transition: unknown = transitions[0];
  if (transitions.length !== 1 || !isRecord(transition) ||
      transition.from !== payload.from || transition.to !== payload.to) return false;
  const committedAt = Date.parse(payload.resultingUpdatedAt);
  const currentVersion = BigInt(workspace.deal.version);
  const expectedVersion = BigInt(attempt.expectedVersion);
  return Number.isFinite(Date.parse(event.createdAt)) && Number.isFinite(committedAt) &&
    committedAt >= Date.parse(attempt.expectedUpdatedAt) && Date.parse(workspace.deal.updatedAt) >= committedAt &&
    currentVersion > expectedVersion &&
    // A single committed step must agree with its resulting snapshot; a later
    // snapshot may have progressed beyond this historical command's target.
    (currentVersion !== expectedVersion + 1n || workspace.deal.status === payload.to);
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasStrings(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof value[key] === 'string');
}

function hasOptionalStrings(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => value[key] == null || typeof value[key] === 'string');
}

function isWorkspace(value: unknown, dealId: string): value is Workspace {
  if (!isRecord(value) || !isRecord(value.deal) || !isRecord(value.roleProjection)) return false;
  const deal = value.deal;
  const projection = value.roleProjection;
  const action = projection.primaryAction;
  if (deal.id !== dealId || !hasStrings(deal, ['id', 'status', 'version', 'updatedAt', 'currency']) ||
      !hasOptionalStrings(deal, ['number', 'culture', 'cropClass', 'volumeTons', 'pricePerTon', 'totalKopecks']) ||
      !hasStrings(projection, ['role', 'focus']) || typeof projection.canAct !== 'boolean' ||
      typeof value.attention !== 'string' || !Array.isArray(value.blockers) ||
      !value.blockers.every((blocker) => typeof blocker === 'string')) return false;
  if (action !== null && (!isRecord(action) || !hasStrings(action, ['id', 'label']) ||
      typeof action.enabled !== 'boolean' || !Array.isArray(action.waitingForRoles) ||
      !action.waitingForRoles.every((role) => typeof role === 'string') ||
      (action.source !== undefined && action.source !== 'USER' && action.source !== 'BANK_CALLBACK'))) return false;
  if (value.money !== null && (!isRecord(value.money) || !hasStrings(value.money, ['status', 'callbackState']) ||
      !hasOptionalStrings(value.money, ['amountKopecks', 'bankRef']))) return false;
  if (!Array.isArray(value.spine) || !value.spine.every((step) => isRecord(step) &&
      hasStrings(step, ['id', 'stage', 'label', 'state']) && ['done', 'active', 'pending'].includes(step.state as string) &&
      (step.source === undefined || step.source === 'USER' || step.source === 'BANK_CALLBACK'))) return false;
  const lists: Array<[unknown, string[], string[]]> = [
    [value.shipments, ['id', 'status'], ['vehicleNumber', 'nextAction']],
    [value.documents, ['id', 'type', 'status', 'name'], []],
    [value.laboratory, ['id', 'status'], ['protocol']],
    [value.acceptance, ['id', 'status', 'qualityStatus'], ['notes']],
    [value.disputes, ['id', 'status', 'description'], []],
    [value.timeline, ['id', 'eventType', 'createdAt'], []],
  ];
  if (!Array.isArray(value.acceptance) || !value.acceptance.every((item) => isRecord(item) &&
      (item.weightActualTons == null || typeof item.weightActualTons === 'string' ||
        (typeof item.weightActualTons === 'number' && Number.isFinite(item.weightActualTons))))) return false;
  return lists.every(([items, required, optional]) => Array.isArray(items) &&
    items.every((item) => isRecord(item) && hasStrings(item, required) && hasOptionalStrings(item, optional)));
}

function formatMoney(kopecks: string | null | undefined, currency = 'RUB', locale: DealLocale = 'ru'): string {
  if (!kopecks || !/^-?\d+$/.test(kopecks)) return '—';
  const negative = kopecks.startsWith('-');
  const digits = negative ? kopecks.slice(1) : kopecks;
  const rubles = digits.length > 2 ? digits.slice(0, -2) : '0';
  const cents = digits.slice(-2).padStart(2, '0');
  const grouped = rubles.replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'ru' ? ' ' : ',');
  const symbol = currency === 'RUB' ? '₽' : currency;
  return `${negative ? '−' : ''}${grouped}${locale === 'ru' ? ',' : '.'}${cents} ${symbol}`;
}

function formatDecimal(value: string | number | null | undefined, suffix: string, locale: DealLocale = 'ru'): string {
  const decimal = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
  if (typeof decimal !== 'string' || !/^\d+(?:\.\d+)?$/.test(decimal)) return '—';
  const [whole, fraction = ''] = decimal.split('.');
  const significant = fraction.replace(/0+$/, '').slice(0, 6);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'ru' ? ' ' : ',');
  return `${grouped}${significant ? `${locale === 'ru' ? ',' : '.'}${significant}` : ''} ${suffix}`;
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
  DRAFT: 'Черновик', ADMISSION_APPROVED: 'Допуск подтверждён', AUCTION_OPEN: 'Аукцион открыт',
  AUCTION_WON: 'Ставка принята', SELLER_SIGNED: 'Подписано продавцом', CONTRACT_SIGNED: 'Договор подписан',
  RESERVE_REQUESTED: 'Резерв запрошен', LOGISTICS_ASSIGNED: 'Перевозка назначена', LOADED: 'Погружено',
  WEIGHED: 'Вес зафиксирован', INSPECTION_CONFIRMED: 'Осмотр подтверждён', QUALITY_ACCEPTED: 'Качество принято',
  DELIVERY_ACCEPTED: 'Поставка принята', DOCUMENTS_COMPLETE: 'Комплект документов закрыт',
  RELEASE_REQUESTED: 'Выплата запрошена', RELEASED: 'Выплачено',
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

function waitingLabel(action: Workspace['roleProjection']['primaryAction'], locale: DealLocale): string {
  if (!action) return '';
  if (action.source === 'BANK_CALLBACK' || action.waitingForRoles.includes('BANK_CALLBACK')) return dealText('подтверждение банка', locale);
  if (action.waitingForRoles.length === 0) return dealText('другой участник сделки', locale);
  return action.waitingForRoles.map((role) => dealRoleText(role, locale)).join(', ');
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
  locale: DealLocale,
): string {
  if (systemAction) return dealText('Банк', locale);
  if (hasBlockers || action?.enabled) return dealText(roleLabel(role), locale);
  return action ? waitingLabel(action, locale) : dealText('Система сделки', locale);
}

export function TransactionDealWorkspace({ role, dealId, locale: requestedLocale }: { role: PlatformRole; dealId: string; locale?: string }) {
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
  const unresolved = React.useRef(new Map<string, PendingAttempt>());
  const [journalReady, setJournalReady] = React.useState(false);
  const [journalError, setJournalError] = React.useState(false);
  const inFlight = React.useRef(false);
  const readGeneration = React.useRef(0);
  const context = React.useRef({ dealId, role });
  context.current = { dealId, role };
  const mounted = React.useRef(true);
  const [, refreshAttempt] = React.useReducer((value: number) => value + 1, 0);
  const unknownAttempt = unresolved.current.get(dealId);
  const [locale, setLocale] = React.useState<DealLocale>(() => dealLocale(requestedLocale));
  const t = (text: string, values?: Readonly<Record<string, string | number>>) => dealText(text, locale, values);
  const copy = locale === 'en' ? RECOVERY_EN : locale === 'zh' ? RECOVERY_ZH : RECOVERY_RU;
  const errorCopy = error === 'INPUT_PROBLEM' ? copy.inputError : error === 'REJECTED' ? copy.rejected : copy.readError;
  const noticeCopy = notice === 'DUPLICATE' ? copy.duplicate : notice === 'CONFLICT' ? copy.conflict : copy.success;

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; readGeneration.current += 1; };
  }, []);

  React.useEffect(() => {
    const updateLocale = () => setLocale(dealLocale(requestedLocale ?? document.documentElement.lang));
    updateLocale();
    const observer = new MutationObserver(updateLocale);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  }, [requestedLocale]);

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
    setJournalReady(false);
    try {
      if (!dealId) throw new HttpError('DEAL_ID_REQUIRED', 400);
      let journalReadable = false;
      try {
        // Reading one localStorage value is atomic; only claims and removals need
        // a lock. Do not delay or serialize ordinary server reads between tabs.
        if (!globalThis.navigator?.locks?.request) throw new Error('PENDING_LOCK_UNAVAILABLE');
        const stored = readPending(dealId);
        if (!current()) return;
        if (stored) unresolved.current.set(dealId, stored);
        setJournalReady(true); setJournalError(false); journalReadable = true;
      } catch {
        if (!current()) return;
        setJournalError(true);
      }
      const response = await fetch(`/api/proxy/deals/${encodeURIComponent(dealId)}/execution-workspace`, {
        method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal,
      });
      const payload: unknown = await readJson(response);
      if (!isWorkspace(payload, dealId)) {
        throw new HttpError('DEAL_STATE_UNVERIFIABLE', 502);
      }
      if (!current()) return;
      if (journalReadable) {
        try {
          const stored = readPending(dealId);
          const attempt = stored ?? unresolved.current.get(dealId);
          if (attempt) unresolved.current.set(dealId, attempt);
          if (attempt && !inFlight.current && hasCommittedAttempt(payload, attempt)) {
            await withPendingLock(dealId, () => {
              if (!current()) return;
              const remaining = clearPendingLocked(attempt);
              if (remaining) unresolved.current.set(dealId, remaining);
              else { unresolved.current.delete(dealId); setNotice('CONFIRMED'); }
            });
          }
        } catch { if (current()) { setJournalReady(false); setJournalError(true); } }
      }
      if (current()) { setWorkspaceContext({ dealId, role }); setWorkspace(payload); refreshAttempt(); }
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

  React.useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === pendingKey(dealId)) { setJournalReady(false); void load(); }
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [dealId, load]);

  async function executePrimaryAction(payload: Record<string, unknown>) {
    const action = workspace?.roleProjection.primaryAction;
    const isSystemAction = action?.source === 'BANK_CALLBACK' || action?.waitingForRoles.includes('BANK_CALLBACK');
    if (!mounted.current || context.current.dealId !== dealId || context.current.role !== role ||
        !workspace || workspace !== latestWorkspace.current || workspace.deal.id !== dealId || workspace.roleProjection.canAct !== true ||
        action?.enabled !== true || isSystemAction || submitting || inFlight.current || !journalReady || journalError ||
        unresolved.current.has(dealId) || loading || reading.current || workspace.blockers.length > 0) return;

    let commandId: string;
    let idempotencyKey: string;
    let body: string;
    let headers: Headers;
    try {
      commandId = globalThis.crypto.randomUUID();
      idempotencyKey = `${workspace.deal.id}:${action.id}:${commandId}`;
      if (!/^\d+$/.test(workspace.deal.version) || !Number.isFinite(Date.parse(workspace.deal.updatedAt))) throw new Error('INVALID_VERSION');
      body = JSON.stringify({ commandId, idempotencyKey,
        expectedUpdatedAt: workspace.deal.updatedAt, expectedVersion: workspace.deal.version, payload,
      });
      headers = applyCsrfHeader({ 'Content-Type': 'application/json', Accept: 'application/json' });
    } catch { setError('INPUT_PROBLEM'); return; }
    const current = () => mounted.current && context.current.dealId === dealId && context.current.role === role;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let attempt: PendingAttempt | undefined;
    let sent = false;
    const settle = async (pending: PendingAttempt) => {
      const remaining = await withPendingLock(dealId, () => clearPendingLocked(pending));
      if (remaining) unresolved.current.set(dealId, remaining);
      else unresolved.current.delete(dealId);
    };
    inFlight.current = true;
    setSubmitting(true); setError(''); setNotice('');
    try {
      const fingerprint = await commandFingerprint(dealId, action.id, body);
      if (!current() || workspace !== latestWorkspace.current || reading.current) return;
      attempt = { schema: 1, dealId, commandId, actionId: action.id, idempotencyKey, fingerprint,
        expectedUpdatedAt: workspace.deal.updatedAt, expectedVersion: workspace.deal.version,
        fromStatus: workspace.deal.status, actorRole: workspace.roleProjection.role };
      const pending = attempt;
      const claimed = await withPendingLock(dealId, () => {
        const previous = readPending(dealId);
        if (previous) { unresolved.current.set(dealId, previous); return false; }
        const serialized = JSON.stringify(pending);
        window.localStorage.setItem(pendingKey(dealId), serialized);
        if (window.localStorage.getItem(pendingKey(dealId)) !== serialized) throw new Error('PENDING_WRITE_UNVERIFIABLE');
        unresolved.current.set(dealId, pending);
        return true;
      });
      if (!claimed) return;
      if (!current() || workspace !== latestWorkspace.current || reading.current) { await settle(pending); return; }
      timeout = setTimeout(() => controller.abort(), 20_000);
      sent = true;
      const response = await fetch(`/api/proxy/deals/${encodeURIComponent(dealId)}/commands/${encodeURIComponent(action.id)}`, {
        method: 'POST', headers, cache: 'no-store', body, signal: controller.signal,
      });
      const result = await readJson(response) as CommandResult & { idempotencyKey?: string };
      if (result?.ok !== true || result.commandId !== commandId || result.dealId !== dealId ||
          result.actionId !== action.id || result.idempotencyKey !== fingerprint) {
        throw new HttpError('COMMAND_RECEIPT_UNVERIFIABLE', 502);
      }
      await settle(pending);
      if (current()) { setNotice(result.duplicate ? 'DUPLICATE' : 'CONFIRMED'); await load(); }
    } catch (reason) {
      const conflict = sent && reason instanceof HttpError && reason.status === 409 && reason.structured &&
        ['DEAL_STATE_CONFLICT', 'STALE_DEAL_VERSION', 'CONCURRENT_DEAL_UPDATE'].includes(reason.code || '');
      const rejected = sent && reason instanceof HttpError && reason.structured && [400, 401, 403, 404, 422].includes(reason.status);
      if ((conflict || rejected) && attempt) {
        try {
          await settle(attempt);
          if (current()) {
            if (conflict) { setNotice('CONFLICT'); await load(); }
            else setError('REJECTED');
          }
        } catch { if (current()) { setJournalReady(false); setJournalError(true); } }
      } else if (sent && attempt) {
        // Already persisted before fetch: unload, timeout and a lost reply cannot
        // erase the attempt. Reading absence or changing roles cannot release it.
        unresolved.current.set(dealId, attempt);
        if (current()) { setError(''); setNotice(''); }
      } else if (current()) {
        try { const stored = readPending(dealId); if (stored) unresolved.current.set(dealId, stored); } catch { /* Keep fail-closed state. */ }
        setJournalReady(false); setJournalError(true);
      }
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      inFlight.current = false;
      if (mounted.current) { setSubmitting(false); refreshAttempt(); }
    }
  }

  const journalNotice = journalError ? (
    <InlineNotice tone='critical' title={copy.storageTitle} role='alert' data-recovery-storage='UNAVAILABLE'>
      {copy.storageBody}
    </InlineNotice>
  ) : null;
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
          {journalNotice}
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
          {journalNotice}
          <Button variant='secondary' onClick={() => void load()} disabled={loading || submitting}>
            <RefreshCw size={18} aria-hidden='true' /> {copy.reload}
          </Button>
        </div>
      </Surface>
    );
  }

  const activeStep = workspace.spine.find((step) => step.state === 'active');
  const action = workspace.roleProjection.primaryAction;
  const systemAction = Boolean(action?.source === 'BANK_CALLBACK' || action?.waitingForRoles.includes('BANK_CALLBACK'));
  const shipment = workspace.shipments[0];
  const acceptance = workspace.acceptance[0];
  const signedDocuments = workspace.documents.filter((item) => item.status === 'SIGNED').length;
  const hasBlockers = workspace.blockers.length > 0;

  const taskTitle = hasBlockers
    ? dealServerText(workspace.blockers[0], locale)
    : systemAction
      ? t('Жди подтверждение банка')
      : action?.enabled
        ? t(action.label)
        : action
          ? t('Жди: {participant}', { participant: waitingLabel(action, locale) })
          : t('Сейчас ничего делать не нужно');

  const taskExplanation = hasBlockers
    ? t('Сначала устрани указанный стоп-фактор. До этого следующий шаг сделки заблокирован.')
    : systemAction
      ? t('Банк проверяет операцию. Состояние изменится автоматически после подтверждённого callback.')
      : action?.enabled
        ? dealServerText(workspace.attention, locale) || t('Заполни только обязательные поля и подтверди действие.')
        : action
          ? t('Следующий шаг выполняет {participant}. Экран обновится после подтверждения.', { participant: waitingLabel(action, locale) })
          : t('Сделка завершена или ожидает системного события.');

  const TaskIcon = hasBlockers ? AlertTriangle : systemAction ? Banknote : ArrowRight;
  const actionExtras = (
    <div className={styles.actionExtras}>
      {hasBlockers && workspace.blockers.length > 1 ? (
        <ul className={styles.blockerList}>
          {workspace.blockers.map((blocker) => <li key={blocker}>{dealServerText(blocker, locale)}</li>)}
        </ul>
      ) : null}

      {!hasBlockers && systemAction ? <p className={styles.systemNote}>{t('Ручное подтверждение невозможно.')}</p> : null}

      {!hasBlockers && action?.enabled && !systemAction ? (
        <DealCommandForm
          actionId={action.id}
          label={t(action.label)}
          locale={locale}
          submitting={submitting}
          disabled={loading || submitting || !journalReady || journalError || Boolean(unknownAttempt) || workspace.roleProjection.canAct !== true}
          initialValues={commandInitialValues(action.id, workspace)}
          onSubmit={executePrimaryAction}
        />
      ) : null}
    </div>
  );

  return (
    <section className={styles.workspace} data-canonical-deal={workspace.deal.id} data-role={role} data-transaction-workspace='v8' lang={locale === 'zh' ? 'zh-CN' : locale}>
      <Surface className={styles.summary} padded={false}>
        <div className={styles.summaryTop}>
          <div className={styles.summaryIdentity}>
            <span className={styles.eyebrow}><Wheat size={18} aria-hidden='true' /> {t('Сделка')}</span>
            <h1>{workspace.deal.number || workspace.deal.id}</h1>
            <p className={styles.summarySubtitle}>
              {workspace.deal.culture || t('Зерно')}
              {workspace.deal.cropClass ? ` · ${t('{class} класс', { class: workspace.deal.cropClass })}` : ''}
              {' · '}{formatDecimal(workspace.deal.volumeTons, t('т'), locale)}
            </p>
          </div>
          <div className={styles.stageBlock} title={workspace.deal.status}>
            <StatusChip tone='information'>{t('Сейчас:')} {t(activeStep?.stage || humanStatus(workspace.deal.status))}</StatusChip>
          </div>
        </div>
        <div className={styles.roleLine}>
          <span className={styles.roleIdentity}><ShieldCheck size={18} aria-hidden='true' />{t(roleLabel(role))}</span>
          <strong className={styles.roleFocus}>{dealServerText(workspace.roleProjection.focus, locale)}</strong>
          <Button className={styles.refreshButton} variant='secondary' onClick={() => void load()} aria-label={copy.reload} disabled={loading || submitting}>
            <RefreshCw size={18} className={loading ? styles.spin : undefined} aria-hidden='true' />
          </Button>
        </div>
      </Surface>

      <NextActionCard
        action={taskTitle}
        reason={taskExplanation}
        label={t(hasBlockers ? 'Сначала реши проблему' : systemAction ? 'Сейчас делать ничего не нужно' : 'Твоё следующее действие')}
        icon={<TaskIcon size={25} />}
        blocked={hasBlockers}
        impact={t('Сумма сделки: {amount}', { amount: formatMoney(workspace.deal.totalKopecks, workspace.deal.currency, locale) })}
        owner={taskOwner(role, action, systemAction, hasBlockers, locale)}
        impactLabel={t('Влияние')}
        ownerLabel={t('Ответственный')}
        deadlineLabel={t('Срок')}
        actions={actionExtras}
      />

      {error || notice || unknownAttempt || journalError ? (
        <div className={styles.messages}>
          {unknownNotice}
          {journalNotice}
          {error ? <InlineNotice tone='critical' icon={<AlertTriangle size={19} />} title={error === 'INPUT_PROBLEM' ? copy.inputTitle : error === 'REJECTED' ? copy.rejectedTitle : copy.readTitle} role='alert'>{errorCopy}</InlineNotice> : null}
          {notice ? <InlineNotice tone={notice === 'CONFLICT' ? 'warning' : 'success'} icon={<CheckCircle2 size={19} />} title={notice === 'CONFLICT' ? copy.conflictTitle : copy.receiptTitle} role='status'>{noticeCopy}</InlineNotice> : null}
        </div>
      ) : null}

      <section className={styles.metrics} aria-label={t('Главные факты сделки')}>
        <article className={styles.metric}>
          <Banknote size={20} aria-hidden='true' />
          <span className={styles.metricCopy}><small className={styles.metricLabel}>{t('Сумма')}</small><strong className={styles.metricValue}>{formatMoney(workspace.deal.totalKopecks, workspace.deal.currency, locale)}</strong></span>
        </article>
        <article className={styles.metric} title={workspace.money?.status || undefined}>
          <ShieldCheck size={20} aria-hidden='true' />
          <span className={styles.metricCopy}><small className={styles.metricLabel}>{t('Деньги')}</small><strong className={styles.metricValue}>{t(humanStatus(workspace.money?.status, 'Ожидаются'))}</strong></span>
        </article>
        <article className={styles.metric} title={shipment?.status}>
          <Truck size={20} aria-hidden='true' />
          <span className={styles.metricCopy}><small className={styles.metricLabel}>{t('Рейс')}</small><strong className={styles.metricValue}>{t(humanStatus(shipment?.status, 'Не назначен'))}</strong></span>
        </article>
        <article className={styles.metric}>
          <FileCheck2 size={20} aria-hidden='true' />
          <span className={styles.metricCopy}><small className={styles.metricLabel}>{t('Документы')}</small><strong className={styles.metricValue}>{workspace.documents.length === 0 ? t('Пока нет') : t('{signed} из {total} подписано', { signed: signedDocuments, total: workspace.documents.length })}</strong></span>
        </article>
      </section>

      <details className={styles.details}>
        <summary>{t('Показать весь путь сделки')}</summary>
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
                <span className={styles.stepCopy}><small>{t(step.stage)}</small><strong>{t(step.label)}</strong></span>
                <span className={styles.stepState}>{t(stepStateLabel(step.state))}</span>
              </li>
            ))}
          </ol>
        </div>
      </details>

      <details className={styles.details}>
        <summary>{t('Факты и доказательства')}</summary>
        <div className={styles.detailsBody}>
          <dl className={styles.factGrid}>
            <div className={styles.factRow}><dt>{t('Цена')}</dt><dd>{formatDecimal(workspace.deal.pricePerTon, `${workspace.deal.currency === 'RUB' ? '₽' : workspace.deal.currency}/${t('т')}`, locale)}</dd></div>
            <div className={styles.factRow}><dt>{t('Вес приёмки')}</dt><dd>{formatDecimal(acceptance?.weightActualTons, t('т'), locale)}</dd></div>
            <div className={styles.factRow}><dt>{t('Качество')}</dt><dd>{t(humanStatus(acceptance?.qualityStatus, 'Не проверено'))}</dd></div>
            <div className={styles.factRow}><dt>{t('Лаборатория')}</dt><dd>{workspace.laboratory.length ? t(humanStatus(workspace.laboratory[0].status)) : t('Нет результата')}</dd></div>
            <div className={styles.factRow}><dt>{t('События')}</dt><dd>{workspace.timeline.length}</dd></div>
            <div className={styles.factRow}><dt>{t('Споры')}</dt><dd>{workspace.disputes.length || t('Нет')}</dd></div>
          </dl>
        </div>
      </details>
    </section>
  );
}

const RECOVERY_RU = {
  unknownTitle: 'Результат действия неизвестен',
  storageTitle: 'Не удалось сохранить защиту от повторной отправки',
  storageBody: 'Отправка заблокирована. Разреши сайту сохранять данные в браузере и повтори загрузку сделки. Незавершённая попытка не будет отправлена повторно.',
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
  storageTitle: 'Repeat-submission protection is unavailable',
  storageBody: 'Sending is blocked. Allow this site to store browser data and reload the deal. An unresolved attempt will not be resent.',
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
  storageTitle: '无法保存防重复提交保护',
  storageBody: '已禁止提交。请允许本站保存浏览器数据，然后重新读取交易。系统不会重新发送结果未确认的操作。',
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
