import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as JsxRuntime from 'react/jsx-runtime';
import designStyles from '../../../../packages/design-system-v8/src/components.module.css';
import emptyStyles from '../../../../packages/design-system-v8/src/EmptyState.module.css';
import * as Icons from 'lucide-react';
import * as Csrf from '../../lib/csrf';
import workspaceStyles from '../../components/transaction-ux/TransactionDealWorkspace.module.css';

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
function snapshot(id = 'deal-a') {
  return {
    deal: { id, number: id, status: 'CONTRACT_SIGNING', version: '7', updatedAt: '2026-09-29T10:00:00.000Z',
      culture: null, cropClass: null, volumeTons: '10', pricePerTon: null, totalKopecks: '100000', currency: 'RUB' },
    roleProjection: { role: 'buyer', focus: 'Review the contract', canAct: true,
      primaryAction: { id: 'buyer_sign_contract', label: 'Confirm contract', enabled: true, source: 'USER', waitingForRoles: [] as string[] } },
    attention: 'Review before signing', blockers: [] as string[], money: null,
    spine: [], shipments: [], documents: [], laboratory: [], acceptance: [], disputes: [], timeline: [],
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
function receipt(body: Posted, url: string, duplicate = false) {
  const parts = url.split('/');
  return { ok: true, duplicate, commandId: body.commandId, dealId: decodeURIComponent(parts[4]),
    actionId: decodeURIComponent(parts[6]), idempotencyKey: 'fp:server-fingerprinted-key', status: 'CONTRACT_SIGNED' };
}
beforeEach(() => {
  posts = []; gets = 0; form.submit = undefined; document.documentElement.lang = 'ru';
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
afterEach(() => { vi.useRealTimers(); cleanup(); vi.unstubAllGlobals(); document.documentElement.lang = 'ru'; document.cookie = 'pc_csrf_token=; Max-Age=0; Path=/'; });
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
    'wrong deal', 'wrong action', 'not accepted', 'generic conflict', 'incomplete receipt', 'timeout', 'throttled',
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
    await act(async () => { first = submit({}); await submit({}); }); expect(posts).toHaveLength(1);
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
    fireEvent.click(screen.getByRole('button', { name: 'Send action' })); view.unmount();
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
    post = (_body, _url, signal) => new Promise((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(new Error('Aborted uncertain POST')), { once: true });
    });
    await ready(); vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Send action' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); }); vi.useRealTimers();
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
});
