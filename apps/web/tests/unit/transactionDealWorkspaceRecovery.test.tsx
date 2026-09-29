import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as JsxRuntime from 'react/jsx-runtime';
import designStyles from '../../../../packages/design-system-v8/src/components.module.css';
import emptyStyles from '../../../../packages/design-system-v8/src/EmptyState.module.css';
import * as Icons from 'lucide-react';
import * as Csrf from '../../lib/csrf';
import workspaceStyles from '../../components/transaction-ux/TransactionDealWorkspace.module.css';
import { buildDealSpine, getDealActionDefinition } from '../../../api/src/modules/deals/deal-command.policy';

type Submit = (payload: Record<string, unknown>) => Promise<void>;
const form: { submit?: Submit } = {};
function CommandForm(props: { onSubmit: Submit; disabled: boolean; submitting: boolean }) {
  form.submit = props.onSubmit;
  return <button disabled={props.disabled || props.submitting} onClick={() => void props.onSubmit({})}>Send action</button>;
}
const webRoot = path.resolve(__dirname, '../..');
const compilerConfig = ts.readConfigFile(path.join(webRoot, 'tsconfig.json'), ts.sys.readFile);
const compilerOptions = ts.parseJsonConfigFileContent(compilerConfig.config, ts.sys, webRoot).options;
const productionRoute = path.join(webRoot, 'app/platform-v7/deals/[id]/execution/page.tsx');
const resolvedFacade = ts.resolveModuleName('@/components/platform-v7/CanonicalDealWorkspace', productionRoute, compilerOptions, ts.sys).resolvedModule!.resolvedFileName;
const resolvedRuntime = ts.resolveModuleName('./TransactionDealWorkspace', resolvedFacade, compilerOptions, ts.sys).resolvedModule!.resolvedFileName;
// Vitest's aliases differ from Next's. Compile the exact production-resolved files, not a rewritten component.
// Only the action-form boundary is mocked; React, design-system components, styles and CSRF are real imports.
function loadExactSource(file: string, dependencies: Record<string, unknown>) {
  const source = fs.readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} as Record<string, React.ComponentType<{ role: 'buyer' | 'seller'; dealId: string }>> };
  const requireKnown = (name: string) => {
    if (name === 'react/jsx-runtime') return JsxRuntime;
    if (!Object.prototype.hasOwnProperty.call(dependencies, name)) throw new Error(`Unexpected production dependency: ${name}`);
    return dependencies[name];
  };
  new Function('require', 'module', 'exports', compiled)(requireKnown, module, module.exports);
  return module.exports;
}
const designRoot = path.resolve(webRoot, '../../packages/design-system-v8/src');
const designComponents = loadExactSource(path.join(designRoot, 'components.tsx'), {
  react: React, './components.module.css': { __esModule: true, default: designStyles },
});
const emptyState = loadExactSource(path.join(designRoot, 'EmptyState.tsx'), {
  './EmptyState.module.css': { __esModule: true, default: emptyStyles },
});
const DesignSystem = loadExactSource(path.join(designRoot, 'index.ts'), {
  './components': designComponents, './EmptyState': emptyState,
});
const runtimeModule = loadExactSource(resolvedRuntime, {
  react: React, 'lucide-react': Icons, '@pc/design-system-v8': DesignSystem,
  '@/components/platform-v7/DealCommandForm': { DealCommandForm: CommandForm }, '@/lib/csrf': Csrf,
  './TransactionDealWorkspace.module.css': { __esModule: true, default: workspaceStyles },
});
const { TransactionDealWorkspace } = runtimeModule;
const { CanonicalDealWorkspace } = loadExactSource(resolvedFacade, { './TransactionDealWorkspace': runtimeModule });
type Posted = { commandId: string; idempotencyKey: string; expectedUpdatedAt: string; expectedVersion: string; payload: unknown };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const buyerTransition = getDealActionDefinition('buyer_sign_contract');
function snapshot(id = 'deal-a') {
  return {
    deal: { id, number: id, status: buyerTransition.from, version: '7', updatedAt: '2026-09-29T10:00:00.000Z',
      culture: null, cropClass: null, volumeTons: '10', pricePerTon: null, totalKopecks: '100000', currency: 'RUB' },
    roleProjection: { role: 'BUYER', focus: 'Review the contract', canAct: true,
      primaryAction: { id: 'buyer_sign_contract', label: 'Confirm contract', enabled: true, source: 'USER', waitingForRoles: [] as string[] } },
    attention: 'Review before signing', blockers: [] as string[], money: null,
    spine: buildDealSpine(buyerTransition.from), shipments: [], documents: [], laboratory: [], acceptance: [], disputes: [], timeline: [],
  };
}
let posts: Array<{ body: Posted; url: string; headers: Headers }>;
let gets: number;
let read: (url: string, count: number, signal?: AbortSignal | null) => Promise<Response>;
let post: (body: Posted, url: string, signal?: AbortSignal | null) => Promise<Response>;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fingerprint(body: Posted, url: string): string {
  const parts = url.split('/');
  const material = { dealId: decodeURIComponent(parts[4]), actionId: decodeURIComponent(parts[6]),
    commandId: body.commandId, clientIdempotencyKey: body.idempotencyKey,
    expectedUpdatedAt: body.expectedUpdatedAt, payload: body.payload ?? {} };
  const stable = (value: any): any => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])) : value;
  return `fp:${createHash('sha256').update(JSON.stringify(stable(material))).digest('hex')}`;
}
const journalKey = (dealId = 'deal-a') => `pc:deal-command:pending:v1:${encodeURIComponent(dealId)}`;
function overrideStorageMethod(method: 'setItem' | 'removeItem', operation: () => void) {
  // Happy DOM binds Storage methods in its proxy; spy on the browser getter so
  // the fault reaches the exact runtime and cannot leak through a bound method.
  const storage = window.localStorage;
  const failingMethod = vi.fn(operation);
  const replacement: Storage = {
    get length() { return storage.length; }, key: storage.key.bind(storage),
    getItem: storage.getItem.bind(storage), setItem: storage.setItem.bind(storage),
    removeItem: storage.removeItem.bind(storage), clear: storage.clear.bind(storage),
  };
  replacement[method] = failingMethod;
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(replacement);
  return failingMethod;
}
function committedSnapshot(body: Posted, url: string) {
  const value = snapshot(decodeURIComponent(url.split('/')[4]));
  return { ...value, deal: { ...value.deal, version: '8', status: 'CONTRACT_SIGNED', updatedAt: '2026-09-29T10:00:01.000Z' },
    spine: buildDealSpine(buyerTransition.to),
    timeline: [{ id: 'event-committed-command', dealId: value.deal.id, tenantId: 'tenant-fixture',
      actorId: 'actor-fixture', actorRole: 'BUYER', eventType: 'BUYER_SIGN_CONTRACT',
      createdAt: '2026-09-29T10:00:01.000Z', hash: 'a'.repeat(64), prevHash: null,
      payload: { commandId: body.commandId, actionId: 'buyer_sign_contract', idempotencyKey: fingerprint(body, url),
        from: buyerTransition.from, to: buyerTransition.to, resultingUpdatedAt: '2026-09-29T10:00:01.000Z', payload: {} } }] };
}
function receipt(body: Posted, url: string, duplicate = false) {
  const parts = url.split('/');
  return { ok: true, duplicate, commandId: body.commandId, dealId: decodeURIComponent(parts[4]),
    actionId: decodeURIComponent(parts[6]), idempotencyKey: fingerprint(body, url), status: 'CONTRACT_SIGNED' };
}
beforeEach(() => {
  posts = []; gets = 0; form.submit = undefined; document.documentElement.lang = 'ru';
  window.localStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
  const held = new Set<string>();
  const navigatorWithLocks = Object.create(navigator);
  Object.defineProperty(navigatorWithLocks, 'locks', { configurable: true, value: {
    request: vi.fn(async (name: string, options: { mode: string; ifAvailable: boolean }, callback: (lock: unknown) => unknown) => {
      expect(options).toEqual({ mode: 'exclusive', ifAvailable: true });
      if (held.has(name)) return callback(null);
      held.add(name);
      try { return await callback({ name, mode: 'exclusive' }); } finally { held.delete(name); }
    }),
  } });
  vi.stubGlobal('navigator', navigatorWithLocks);
  read = async (url) => json(snapshot(decodeURIComponent(url.split('/')[4])));
  post = async () => { throw new TypeError('Lost acknowledgement'); };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as Posted;
      posts.push({ body, url, headers: new Headers(init.headers) });
      return post(body, url, init.signal);
    }
    expect(init?.method).toBe('GET'); gets += 1; return read(url, gets, init?.signal);
  }));
});
afterEach(() => { vi.useRealTimers(); cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.localStorage.clear(); document.documentElement.lang = 'ru'; document.cookie = 'pc_csrf_token=; Max-Age=0; Path=/'; });
async function ready(id = 'deal-a') {
  const view = render(<CanonicalDealWorkspace role='buyer' dealId={id} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send action' })).not.toBeDisabled());
  return view;
}
async function expectUnknown() {
  await waitFor(() => {
    const notice = document.querySelector('[data-command-outcome="UNKNOWN"]');
    expect(notice).not.toBeNull(); expect(notice?.textContent).toContain(posts[0].body.commandId);
  });
  return document.querySelector('[data-command-outcome="UNKNOWN"]')!;
}
function reload() { fireEvent.click(screen.getByRole('button', { name: /Повторить загрузку сделки|Reload deal state|重新读取交易状态/ })); }

describe('production-resolved Deal recovery', () => {
  it('resolves the real protected route to this facade and runtime, not the generic Vitest alias', () => {
    const web = webRoot;
    const cfg = ts.readConfigFile(path.join(web, 'tsconfig.json'), ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, web);
    const route = path.join(web, 'app/platform-v7/deals/[id]/execution/page.tsx');
    expect(fs.readFileSync(route, 'utf8')).toContain('@/components/platform-v7/CanonicalDealWorkspace');
    const facade = ts.resolveModuleName('@/components/platform-v7/CanonicalDealWorkspace', route, parsed.options, ts.sys).resolvedModule!.resolvedFileName;
    expect(facade).toBe(path.join(web, 'components/transaction-ux/CanonicalDealWorkspace.tsx'));
    expect(fs.readFileSync(facade, 'utf8')).toContain("TransactionDealWorkspace as CanonicalDealWorkspace } from './TransactionDealWorkspace'");
    expect(ts.resolveModuleName('./TransactionDealWorkspace', facade, parsed.options, ts.sys).resolvedModule!.resolvedFileName)
      .toBe(path.join(web, 'components/transaction-ux/TransactionDealWorkspace.tsx'));
    expect(CanonicalDealWorkspace).toBe(TransactionDealWorkspace);
  });
  const uncertain = [
    'network', 'server failure', 'empty', 'invalid JSON', 'missing identity', 'wrong command',
    'wrong deal', 'wrong action', 'wrong fingerprint', 'not accepted', 'generic conflict', 'incomplete receipt', 'timeout', 'throttled',
  ] as const;
  it.each(uncertain)('keeps UNKNOWN and blocks replay after %s', async (mode) => {
    post = async (body, url) => {
      if (mode === 'network') throw new TypeError('Lost reply');
      if (mode === 'server failure') return json({ message: 'Unavailable' }, 503);
      if (mode === 'empty') return new Response(null, { status: 204 });
      if (mode === 'invalid JSON') return new Response('{bad', { status: 200 });
      if (mode === 'missing identity') return json({ ok: true });
      if (mode === 'generic conflict') return json({ message: 'Conflict' }, 409);
      if (mode === 'incomplete receipt') return json({ message: 'Stored command receipt is incomplete' }, 409);
      if (mode === 'timeout') return json({ message: 'Timeout' }, 408);
      if (mode === 'throttled') return json({ message: 'Rate limited' }, 429);
      const value = receipt(body, url);
      if (mode === 'wrong command') value.commandId = 'other-command';
      if (mode === 'wrong deal') value.dealId = 'other-deal';
      if (mode === 'wrong action') value.actionId = 'other-action';
      if (mode === 'wrong fingerprint') value.idempotencyKey = 'fp:' + '0'.repeat(64);
      if (mode === 'not accepted') value.ok = false;
      return json(value);
    };
    await ready(); const staleSubmit = form.submit!;
    fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled();
    await act(async () => { await staleSubmit({}); await form.submit!({}); });
    expect(posts).toHaveLength(1); expect(gets).toBe(1);
  });
  it.each([false, true])('accepts only a matching server receipt, including fingerprinted keys (duplicate=%s)', async (duplicate) => {
    post = async (body, url) => json(receipt(body, url, duplicate));
    document.cookie = 'pc_csrf_token=recovery-fixture; Path=/'; await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Send action' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Ответ сервера подтверждён'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send action' })).not.toBeDisabled());
    expect(document.querySelector('[data-command-outcome="UNKNOWN"]')).toBeNull();
    expect(posts).toHaveLength(1); expect(gets).toBe(2);
    expect(posts[0].body.expectedVersion).toBe('7'); expect(posts[0].body.expectedUpdatedAt).toBe(snapshot().deal.updatedAt);
    expect(posts[0].headers.get('x-csrf-token')).toBe('recovery-fixture');
  });
  it('blocks same-tick direct handler duplication before React commits submitting state', async () => {
    const reply = deferred<Response>(); post = () => reply.promise; await ready();
    const submit = form.submit!; let first!: Promise<void>;
    await act(async () => { first = submit({}); await submit({}); }); await waitFor(() => expect(posts).toHaveLength(1));
    await act(async () => { reply.reject(new TypeError('lost')); await first; }); await expectUnknown();
  });
  it('preserves the attempt when GET advances the action and version', async () => {
    await ready(); const oldSubmit = form.submit!;
    fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    read = async () => { const value = snapshot(); value.deal.version = '99'; value.deal.status = 'COMPLETED';
      value.roleProjection.primaryAction.id = 'accept_delivery'; return json(value); };
    reload(); await waitFor(() => expect(gets).toBe(2)); await expectUnknown();
    await act(async () => { await oldSubmit({}); await form.submit!({}); });
    expect(posts).toHaveLength(1); expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled();
  });
  it.each(['ru', 'en', 'zh-CN', 'zh_CN', 'en-GB'])('keeps recovery native and GET-only after failed reads in %s', async (lang) => {
    document.documentElement.lang = lang; await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    read = async () => { throw new TypeError('read unavailable'); }; reload();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Send action' })).toBeNull());
    const notice = await expectUnknown();
    if (!lang.startsWith('ru')) expect(notice.textContent).not.toMatch(/[А-Яа-яЁё]/u);
    read = async () => json(snapshot()); reload();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled());
    await expectUnknown(); expect(posts).toHaveLength(1); expect(gets).toBe(3);
  });
  it('switches recovery language without losing identity or issuing network calls', async () => {
    await ready(); fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    for (const lang of ['en', 'zh-CN', 'ru']) {
      await act(async () => { document.documentElement.lang = lang; });
      const notice = await expectUnknown();
      if (lang !== 'ru') expect(notice.textContent).not.toMatch(/[А-Яа-яЁё]/u);
    }
    expect(posts).toHaveLength(1); expect(gets).toBe(1);
  });
  it.each([400, 401, 403, 404, 422])('keeps a definite structured rejection distinct from UNKNOWN (%s)', async (status) => {
    post = async () => json({ message: 'Rejected by server' }, status); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Send action' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Сервер отклонил действие'));
    expect(document.querySelector('[data-command-outcome="UNKNOWN"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send action' })).not.toBeDisabled(); expect(posts).toHaveLength(1);
  });
  it.each(['DEAL_STATE_CONFLICT', 'STALE_DEAL_VERSION', 'CONCURRENT_DEAL_UPDATE'])('reconciles definite %s with GET, not a second POST', async (code) => {
    post = async () => json({ code, message: 'State changed' }, 409); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Send action' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Данные изменились другим участником'));
    await waitFor(() => expect(gets).toBe(2)); expect(posts).toHaveLength(1);
    expect(document.querySelector('[data-command-outcome="UNKNOWN"]')).toBeNull();
  });
  it('does not send or mark UNKNOWN when preparing the request fails before POST', async () => {
    await ready(); const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    await act(async () => { await form.submit!(cyclic); });
    expect(posts).toHaveLength(0); expect(document.querySelector('[data-command-outcome="UNKNOWN"]')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Запрос не удалось подготовить');
  });
  it('keeps a stale form handler from issuing a command after the action changes', async () => {
    await ready(); const stale = form.submit!;
    read = async () => { const value = snapshot(); value.roleProjection.primaryAction.id = 'accept_delivery'; return json(value); };
    reload(); await waitFor(() => expect(form.submit).not.toBe(stale));
    await act(async () => { await stale({}); }); expect(posts).toHaveLength(0);
  });
  it('blocks a command synchronously while a refresh is in flight', async () => {
    await ready(); const pending = deferred<Response>(); read = () => pending.promise;
    const submit = form.submit!; reload();
    await act(async () => { await submit({}); }); expect(posts).toHaveLength(0);
    await act(async () => { pending.resolve(json(snapshot())); });
  });
  it('retains the first deal attempt across a mounted deal switch and late lost response', async () => {
    const reply = deferred<Response>(); post = () => reply.promise; const view = await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Send action' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    view.rerender(<CanonicalDealWorkspace role='buyer' dealId='deal-b' />);
    await waitFor(() => expect(document.querySelector('[data-canonical-deal="deal-b"]')).not.toBeNull());
    expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled();
    await act(async () => { reply.reject(new TypeError('lost')); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send action' })).not.toBeDisabled());
    expect(document.querySelector('[data-command-outcome="UNKNOWN"]')).toBeNull();
    view.rerender(<CanonicalDealWorkspace role='buyer' dealId='deal-a' />);
    await expectUnknown(); expect(posts).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled());
  });
  it('ignores a late read from a different deal', async () => {
    const first = deferred<Response>(); read = async (url, count) => count === 1 ? first.promise : json(snapshot(url.split('/')[4]));
    const view = render(<CanonicalDealWorkspace role='buyer' dealId='deal-a' />);
    view.rerender(<CanonicalDealWorkspace role='buyer' dealId='deal-b' />);
    await waitFor(() => expect(document.querySelector('[data-canonical-deal="deal-b"]')).not.toBeNull());
    await act(async () => { first.resolve(json(snapshot('deal-a'))); });
    expect(document.querySelector('[data-canonical-deal="deal-b"]')).not.toBeNull(); expect(posts).toHaveLength(0);
  });
  it('does not start a receipt refresh after unmount', async () => {
    const reply = deferred<Response>(); post = () => reply.promise; const view = await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Send action' }));
    await waitFor(() => expect(posts).toHaveLength(1)); view.unmount();
    await act(async () => { reply.resolve(json(receipt(posts[0].body, posts[0].url))); }); expect(gets).toBe(1);
  });
  it.each(['cannot act', 'disabled action', 'bank source', 'bank waiting', 'blocker'])('preserves server-controlled eligibility: %s', async (mode) => {
    read = async () => { const value = snapshot();
      if (mode === 'cannot act') value.roleProjection.canAct = false;
      if (mode === 'disabled action') value.roleProjection.primaryAction.enabled = false;
      if (mode === 'bank source') value.roleProjection.primaryAction.source = 'BANK_CALLBACK';
      if (mode === 'bank waiting') value.roleProjection.primaryAction.waitingForRoles = ['BANK_CALLBACK'];
      if (mode === 'blocker') value.blockers = ['Server blocker'];
      return json(value);
    };
    render(<CanonicalDealWorkspace role='buyer' dealId='deal-a' />);
    await waitFor(() => expect(document.querySelector('[data-canonical-deal="deal-a"]')).not.toBeNull());
    const button = screen.queryByRole('button', { name: 'Send action' });
    if (button) { expect(button).toBeDisabled(); await act(async () => { await form.submit!({}); }); }
    expect(posts).toHaveLength(0);
  });
  it('retains UNKNOWN across role changes in the same mounted deal', async () => {
    const view = await ready(); fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    view.rerender(<CanonicalDealWorkspace role='seller' dealId='deal-a' />); await expectUnknown();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled()); expect(posts).toHaveLength(1);
  });
  it('rejects a recovery read for another deal without releasing the attempt', async () => {
    await ready(); fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    read = async () => json(snapshot('wrong-deal')); reload();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Send action' })).toBeNull());
    await expectUnknown(); expect(document.querySelector('[data-canonical-deal="wrong-deal"]')).toBeNull(); expect(posts).toHaveLength(1);
  });

  it('turns an expired POST into UNKNOWN without resending it', async () => {
    const sent = deferred<void>();
    post = (_body, _url, signal) => new Promise((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(new Error('Aborted uncertain POST')), { once: true }); sent.resolve();
    });
    await ready(); vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Send action' }));
    await act(async () => { await sent.promise; await vi.advanceTimersByTimeAsync(20_000); }); vi.useRealTimers();
    await expectUnknown(); expect(posts).toHaveLength(1); expect(gets).toBe(1);
  });
  it('retains UNKNOWN when a recovery read expires', async () => {
    await ready(); fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    read = (_url, _count, signal) => new Promise((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(new Error('Aborted read')), { once: true });
    });
    vi.useFakeTimers(); reload();
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000); }); vi.useRealTimers();
    await expectUnknown(); expect(posts).toHaveLength(1); expect(gets).toBe(2);
    expect(screen.queryByRole('button', { name: 'Send action' })).toBeNull();
  });

  it.each([
    'missing waiting roles', 'null spine item', 'object attention', 'object status', 'numeric amount',
    'null shipment', 'null document', 'null laboratory', 'null acceptance', 'null dispute', 'null event',
    'object focus', 'object action label', 'non-string waiting role', 'object blocker', 'object money status',
  ])('rejects nested malformed recovery without losing UNKNOWN: %s', async (mode) => {
    await ready(); fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    read = async () => {
      const value: any = snapshot();
      if (mode === 'missing waiting roles') delete value.roleProjection.primaryAction.waitingForRoles;
      if (mode === 'null spine item') value.spine = [null];
      if (mode === 'object attention') value.attention = {};
      if (mode === 'object status') value.deal.status = {};
      if (mode === 'numeric amount') value.deal.totalKopecks = 100000;
      if (mode === 'null shipment') value.shipments = [null];
      if (mode === 'null document') value.documents = [null];
      if (mode === 'null laboratory') value.laboratory = [null];
      if (mode === 'null acceptance') value.acceptance = [null];
      if (mode === 'null dispute') value.disputes = [null];
      if (mode === 'null event') value.timeline = [null];
      if (mode === 'object focus') value.roleProjection.focus = {};
      if (mode === 'object action label') value.roleProjection.primaryAction.label = {};
      if (mode === 'non-string waiting role') value.roleProjection.primaryAction.waitingForRoles = [{}];
      if (mode === 'object blocker') value.blockers = [{}];
      if (mode === 'object money status') value.money = { status: {}, amountKopecks: null, callbackState: 'WAITING', bankRef: null };
      return json(value);
    };
    reload(); await waitFor(() => expect(screen.queryByRole('button', { name: 'Send action' })).toBeNull());
    await expectUnknown(); expect(posts).toHaveLength(1);
    read = async () => json(snapshot()); reload();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled());
    await expectUnknown(); expect(posts).toHaveLength(1); expect(gets).toBe(3);
  });

  it('accepts populated canonical collections, including the server numeric acceptance weight', async () => {
    read = async () => json({ ...snapshot(),
      money: { status: 'PENDING', callbackState: 'NONE', amountKopecks: '100000', bankRef: null },
      spine: [{ id: 'contract', stage: 'CONTRACT', label: 'Contract', state: 'active', source: 'USER' }],
      shipments: [{ id: 'shipment-a', status: 'PENDING', vehicleNumber: null, nextAction: null }],
      documents: [{ id: 'doc-a', type: 'CONTRACT', status: 'SIGNED', name: 'Contract' }],
      laboratory: [{ id: 'sample-a', status: 'PENDING', protocol: null }],
      acceptance: [{ id: 'acceptance-a', status: 'PENDING', qualityStatus: 'PENDING', weightActualTons: 20.5, notes: null }],
      disputes: [{ id: 'dispute-a', status: 'CLOSED', description: 'Resolved' }],
      timeline: [{ id: 'event-a', eventType: 'CREATED', createdAt: '2026-09-29T10:00:00.000Z' }],
    });
    await ready(); expect(screen.getByText('20,5 т')).toBeTruthy(); expect(posts).toHaveLength(0);
  });
});


describe('remaining durable recovery regression', () => {
  it('retains the uncertain attempt through a complete component remount', async () => {
    const first = await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Send action' }));
    await expectUnknown();
    const attemptId = posts[0].body.commandId;
    first.unmount();
    render(<CanonicalDealWorkspace role='buyer' dealId='deal-a' />);
    await waitFor(() => expect(gets).toBe(2));
    await waitFor(() => {
      const notice = document.querySelector('[data-command-outcome="UNKNOWN"]');
      expect(notice).not.toBeNull();
      expect(notice?.textContent).toContain(attemptId);
      expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled();
    });
    expect(posts).toHaveLength(1);
  });

  it('reconciles the exact canonical committed command event from the existing GET without another POST', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Send action' }));
    await expectUnknown();
    const attempted = posts[0].body;
    read = async () => json(committedSnapshot(attempted, posts[0].url));
    reload();
    await waitFor(() => expect(document.querySelector('[data-command-outcome="UNKNOWN"]')).toBeNull());
    expect(posts).toHaveLength(1);
  });
});


describe('persistent pending-command boundary', () => {
  it('verifies the minimal persistent brake before POST without persisting form payload or credentials', async () => {
    post = async (body, url) => {
      const serialized = window.localStorage.getItem(journalKey())!;
      const pending = JSON.parse(serialized);
      expect(pending.commandId).toBe(body.commandId);
      expect(pending.fingerprint).toBe(fingerprint(body, url));
      expect(Object.keys(pending).sort()).toEqual(['schema', 'dealId', 'commandId', 'actionId', 'idempotencyKey',
        'fingerprint', 'expectedUpdatedAt', 'expectedVersion', 'fromStatus', 'actorRole'].sort());
      expect(serialized).not.toContain('private-document');
      expect(serialized).not.toContain('private-evidence');
      expect(serialized).not.toContain('csrf-fixture');
      throw new TypeError('reply lost');
    };
    document.cookie = 'pc_csrf_token=csrf-fixture; Path=/';
    await ready();
    await act(async () => { await form.submit!({ documentId: 'private-document', signatureEvidenceRef: 'private-evidence',
      nested: { z: [3, { y: '中文', a: 'данные' }], a: true } }); });
    await expectUnknown(); expect(posts).toHaveLength(1);
  });

  it('retains a pending request after unloading before the POST reply exists', async () => {
    const reply = deferred<Response>(); post = () => reply.promise;
    const first = await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Send action' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    first.unmount(); render(<CanonicalDealWorkspace role='buyer' dealId='deal-a' />);
    await expectUnknown();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled());
    await act(async () => { await form.submit!({}); reply.reject(new TypeError('reply lost')); });
    expect(posts).toHaveLength(1);
  });

  it('recovers a committed attempt on remount using GET only and deletes only that journal entry', async () => {
    const first = await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    window.localStorage.setItem('unrelated-key', 'keep');
    first.unmount(); read = async () => json(committedSnapshot(posts[0].body, posts[0].url));
    render(<CanonicalDealWorkspace role='buyer' dealId='deal-a' />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Ответ сервера подтверждён'));
    expect(window.localStorage.getItem(journalKey())).toBeNull();
    expect(window.localStorage.getItem('unrelated-key')).toBe('keep');
    expect(posts).toHaveLength(1); expect(gets).toBe(2);
  });

  it.each([{ name: 'invalid JSON', raw: '{bad' }, { name: 'empty schema', raw: '{}' },
    { name: 'future schema', raw: '{"schema":2}' }, { name: 'oversized', raw: 'x'.repeat(5000) }])
  ('fails closed on a malformed persistent record ($name)', async ({ raw }) => {
    window.localStorage.setItem(journalKey(), raw);
    render(<CanonicalDealWorkspace role='buyer' dealId='deal-a' />);
    await waitFor(() => expect(document.querySelector('[data-canonical-deal="deal-a"]')).not.toBeNull());
    expect(document.querySelector('[data-recovery-storage="UNAVAILABLE"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled();
    await act(async () => { await form.submit!({}); }); expect(posts).toHaveLength(0);
    expect(window.localStorage.getItem(journalKey())).toBe(raw);
  });

  it('blocks before POST when the browser cannot persist the attempt', async () => {
    await ready();
    const fault = overrideStorageMethod('setItem', () => { throw new DOMException('Quota', 'QuotaExceededError'); });
    await act(async () => { await form.submit!({}); });
    expect(fault).toHaveBeenCalledOnce(); expect(posts).toHaveLength(0);
    expect(document.querySelector('[data-recovery-storage="UNAVAILABLE"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled();
  });

  it('blocks before POST when the write does not survive immediate read-back', async () => {
    await ready(); const fault = overrideStorageMethod('setItem', () => undefined);
    await act(async () => { await form.submit!({}); });
    expect(fault).toHaveBeenCalledOnce(); expect(posts).toHaveLength(0); expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled();
  });

  it('keeps server reads available but business sends disabled without a browser lock manager', async () => {
    const noLocks = Object.create(navigator); Object.defineProperty(noLocks, 'locks', { value: undefined });
    vi.stubGlobal('navigator', noLocks);
    render(<CanonicalDealWorkspace role='buyer' dealId='deal-a' />);
    await waitFor(() => expect(document.querySelector('[data-canonical-deal="deal-a"]')).not.toBeNull());
    expect(gets).toBe(1); expect(posts).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled();
    await act(async () => { await form.submit!({}); }); expect(posts).toHaveLength(0);
  });

  it('arbitrates simultaneous same-origin workspaces without creating two attempt IDs or POSTs', async () => {
    await ready(); const firstSubmit = form.submit!;
    render(<CanonicalDealWorkspace role='buyer' dealId='deal-a' />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Send action' })).toHaveLength(2));
    await waitFor(() => screen.getAllByRole('button', { name: 'Send action' }).forEach((button) => expect(button).not.toBeDisabled()));
    const secondSubmit = form.submit!;
    await act(async () => { await Promise.all([firstSubmit({ different: 'first' }), secondSubmit({ different: 'second' })]); });
    expect(posts).toHaveLength(1);
    const pending = JSON.parse(window.localStorage.getItem(journalKey())!);
    expect(pending.commandId).toBe(posts[0].body.commandId);
    screen.getAllByRole('button', { name: 'Send action' }).forEach((button) => expect(button).toBeDisabled());
    expect(document.querySelectorAll('[data-command-outcome="UNKNOWN"]')).toHaveLength(2);
  });

  it('does not let local deletion alone confirm an already-mounted uncertain command', async () => {
    await ready(); fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    window.localStorage.removeItem(journalKey());
    await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: journalKey(), newValue: null })); });
    await expectUnknown(); expect(posts).toHaveLength(1); expect(gets).toBe(2);
    expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled();
  });

  it('retains the brake when confirmed-event journal cleanup fails', async () => {
    await ready(); fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    const raw = window.localStorage.getItem(journalKey());
    read = async () => json(committedSnapshot(posts[0].body, posts[0].url));
    const fault = overrideStorageMethod('removeItem', () => { throw new Error('Storage unavailable'); });
    await act(async () => { reload(); });
    await expectUnknown(); expect(fault).toHaveBeenCalledOnce(); expect(window.localStorage.getItem(journalKey())).toBe(raw);
    expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled(); expect(posts).toHaveLength(1);
  });

  it.each([400, 401, 403, 404, 422, 409])('clears its own persistent brake after a definite direct rejection (%s)', async (status) => {
    post = async () => json({ code: status === 409 ? 'STALE_DEAL_VERSION' : 'REJECTED', message: 'Rejected by server' }, status);
    const first = await ready(); fireEvent.click(screen.getByRole('button', { name: 'Send action' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    await waitFor(() => expect(window.localStorage.getItem(journalKey())).toBeNull());
    first.unmount(); await ready();
    expect(document.querySelector('[data-command-outcome="UNKNOWN"]')).toBeNull(); expect(posts).toHaveLength(1);
  });
});

describe('exact committed-event reconciliation', () => {
  it.each(['command', 'action', 'deal', 'event type', 'actor role', 'actor', 'tenant', 'fingerprint', 'from', 'to',
    'hash', 'event time', 'result time', 'future result', 'unadvanced version', 'invalid version', 'duplicate'])
  ('keeps UNKNOWN when canonical evidence has a mismatched or invalid %s', async (mode) => {
    await ready(); fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    const raw = window.localStorage.getItem(journalKey());
    read = async () => {
      const value = committedSnapshot(posts[0].body, posts[0].url);
      const event = value.timeline[0];
      if (mode === 'command') event.payload.commandId = 'other-command';
      if (mode === 'action') event.payload.actionId = 'seller_sign_contract';
      if (mode === 'deal') event.dealId = 'deal-b';
      if (mode === 'event type') event.eventType = 'OTHER_EVENT';
      if (mode === 'actor role') event.actorRole = 'FARMER';
      if (mode === 'actor') event.actorId = '';
      if (mode === 'tenant') event.tenantId = '';
      if (mode === 'fingerprint') event.payload.idempotencyKey = 'fp:' + '0'.repeat(64);
      if (mode === 'from') event.payload.from = 'OTHER_STATE';
      if (mode === 'to') event.payload.to = event.payload.from;
      if (mode === 'hash') event.hash = '';
      if (mode === 'event time') event.createdAt = 'not-a-date';
      if (mode === 'result time') event.payload.resultingUpdatedAt = 'not-a-date';
      if (mode === 'future result') event.payload.resultingUpdatedAt = '2026-09-30T10:00:00.000Z';
      if (mode === 'unadvanced version') value.deal.version = '7';
      if (mode === 'invalid version') value.deal.version = 'unverified';
      if (mode === 'duplicate') value.timeline.push({ ...event, id: 'second-conflicting-event' });
      return json(value);
    };
    await act(async () => { reload(); });
    await expectUnknown(); expect(posts).toHaveLength(1); expect(gets).toBe(2);
    expect(window.localStorage.getItem(journalKey())).toBe(raw);
    expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled();
  });
});


describe('producer-backed committed-state consistency', () => {
  it.each(['contradictory to', 'invalid to', 'immediate snapshot', 'missing transition',
    'duplicate transition', 'transition from', 'transition to', 'missing later transition'])
  ('retains UNKNOWN for %s without another POST', async (mode) => {
    await ready(); fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    const raw = window.localStorage.getItem(journalKey());
    read = async () => {
      const value = committedSnapshot(posts[0].body, posts[0].url);
      const transition = value.spine.find((step) => step.id === 'buyer_sign_contract')!;
      if (mode === 'contradictory to') value.timeline[0].payload.to = 'CLOSED';
      if (mode === 'invalid to') value.timeline[0].payload.to = 'NOT_A_CANONICAL_STATE';
      if (mode === 'immediate snapshot') value.deal.status = 'CLOSED';
      if (mode === 'missing transition') value.spine = value.spine.filter((step) => step.id !== 'buyer_sign_contract');
      if (mode === 'duplicate transition') value.spine.push({ ...transition });
      if (mode === 'transition from') transition.from = 'UNVERIFIED';
      if (mode === 'transition to') transition.to = 'UNVERIFIED';
      if (mode === 'missing later transition') {
        value.deal.version = '9'; value.deal.status = 'RESERVE_REQUESTED';
        value.deal.updatedAt = '2026-09-29T10:00:02.000Z'; value.spine = [];
      }
      return json(value);
    };
    await act(async () => { reload(); });
    await expectUnknown();
    expect(window.localStorage.getItem(journalKey())).toBe(raw);
    expect(screen.getByRole('button', { name: 'Send action' })).toBeDisabled();
    expect(posts).toHaveLength(1); expect(gets).toBe(2);
  });

  it('recovers an exact historical command after legitimate later progression', async () => {
    const first = await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Send action' })); await expectUnknown();
    read = async () => {
      const value = committedSnapshot(posts[0].body, posts[0].url);
      const later = getDealActionDefinition('request_reserve');
      expect(value.timeline[0].payload.to).toBe(later.from);
      value.deal.version = '9'; value.deal.status = later.to;
      value.deal.updatedAt = '2026-09-29T10:00:02.000Z'; value.spine = buildDealSpine(later.to);
      return json(value);
    };
    first.unmount(); render(<CanonicalDealWorkspace role='buyer' dealId='deal-a' />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Ответ сервера подтверждён'));
    expect(window.localStorage.getItem(journalKey())).toBeNull();
    expect(posts).toHaveLength(1); expect(gets).toBe(2);
  });
});
