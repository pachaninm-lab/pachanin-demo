import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { encodeFrame, type GatewayFrame } from '@pc/ai-assistant-stream-contract';
import { GektaChatWorkspace } from '@/components/gekta/GektaChatWorkspace';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule } from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_CONTEXT_COPY, DocumentContextError, GektaDocumentRetryCache, readDocumentContext } from '@/lib/gekta/document-context';

const doc = (text = 'Начало\n  x < 12 && y > 3\n' + 'я'.repeat(6_000) + '\nQA_END_987', truncated = false) => ({ name: 'Условия.docx', text, truncated });
const source = readFileSync('components/gekta/GektaChatWorkspace.tsx', 'utf8');
function actualCallback(name: 'submit' | 'retry', context: Record<string, unknown>) {
  const start = source.indexOf(`const ${name} = React.useCallback(`);
  const end = source.indexOf('\n  }, [', start);
  const finish = source.indexOf(');', end) + 2;
  expect(start).toBeGreaterThan(-1); expect(finish).toBeGreaterThan(start);
  const js = transpileModule(source.slice(start, finish) + `\nglobalThis.callback = ${name};`, {}).outputText;
  return runInNewContext(js + '\ncallback', { React: { useCallback: (f: unknown) => f }, ...context }) as (...args: unknown[]) => Promise<void>;
}
function client(documents = [doc()]) {
  const cache = new GektaDocumentRetryCache();
  const context = {
    documents, sending: false, input: 'Проверь условия договора по зерну.', locale: 'ru', activeId: 'conversation-1', messages: [] as unknown[],
    documentRetries: { current: cache }, readDocumentContext, DOCUMENT_CONTEXT_COPY,
    submittingPrompt: { current: null as number | null }, promptIntentRevision: { current: 0 },
    reservationController: { current: null as AbortController | null }, pendingConsentedPrompt: { current: null as { question: string; locale: string } | null },
    AbortController, setConsentRequested: vi.fn(), setEnteredChat: vi.fn(),
    cleanText: (s: string) => s, id: () => 'user-1', titleFrom: (s: string) => s,
    historyFrom: () => [], reserveAnswer: vi.fn(async () => 'one-use-ticket'), runGeneration: vi.fn(async () => undefined),
    saveConversation: vi.fn(), focusComposer: vi.fn(), onEnteredChat: vi.fn(), track: vi.fn(),
    setError: vi.fn(), setInput: vi.fn(), setActiveId: vi.fn(), setMessages: vi.fn(), setDocuments: vi.fn(),
  };
  return { cache, context };
}

describe('G-A04 structured extracted document context', () => {
  it('preserves the end, comparisons, indentation and incomplete marker', () => {
    expect(readDocumentContext([doc(undefined, true)])).toEqual([doc(undefined, true)]);
  });
  it('accepts the exact existing per-file and total extraction bounds', () => {
    const docs = [doc('甲'.repeat(12_000)), doc('б'.repeat(12_000)), doc('x'.repeat(8_000))];
    expect(readDocumentContext(docs)).toEqual(docs);
  });
  it.each([null, {}, 'text', [null], [doc('')], [{ ...doc(), truncated: 'false' }], [{ ...doc(), name: '' }]].map(value => [value]))('rejects malformed context without silently substituting it: %j', value => {
    expect(() => readDocumentContext(value)).toThrow(DocumentContextError);
  });
  it.each([[doc('x'.repeat(12_001))], Array.from({ length: 5 }, () => doc('x')), [doc('a'.repeat(12_000)), doc('b'.repeat(12_000)), doc('c'.repeat(8_001))]].map(value => [value]))('rejects overflow instead of cutting off evidence', value => {
    expect(() => readDocumentContext(value)).toThrow(DocumentContextError);
    try { readDocumentContext(value); } catch (e) { expect((e as DocumentContextError).status).toBe(413); }
  });
  it('sends full extracted text separately and persists only attachment summaries', async () => {
    const { context } = client();
    await actualCallback('submit', context)();
    const request = context.runGeneration.mock.calls[0] as unknown as [{ question: string; documents: unknown }];
    expect(request[0].question).toBe(context.input);
    expect(request[0].documents).toEqual(context.documents);
    const saved = JSON.stringify(context.saveConversation.mock.calls);
    expect(saved).toContain('Условия.docx');
    expect(saved).not.toContain('QA_END_987');
  });
  it('rejects oversized documents before consuming an answer reservation', async () => {
    const { context } = client([doc('x'.repeat(12_001))]);
    await actualCallback('submit', context)();
    expect(context.reserveAnswer).not.toHaveBeenCalled();
    expect(context.runGeneration).not.toHaveBeenCalled();
    expect(context.setError).toHaveBeenCalledWith(DOCUMENT_CONTEXT_COPY.ru.invalid);
  });
  it('retains documents when first submission requests consent, then sends one complete snapshot on resume', async () => {
    const { cache, context } = client();
    const original = readDocumentContext(context.documents);
    context.reserveAnswer.mockImplementationOnce(async (onConsentRequired?: () => void) => {
      onConsentRequired?.();
      return null as unknown as string;
    });
    await actualCallback('submit', context)();
    expect(context.pendingConsentedPrompt.current).toEqual({ question: context.input, locale: 'ru' });
    expect(context.setConsentRequested).toHaveBeenCalledWith(true);
    expect(context.setDocuments).not.toHaveBeenCalled();
    expect(context.runGeneration).not.toHaveBeenCalled();
    expect(context.saveConversation).not.toHaveBeenCalled();
    await actualCallback('submit', context)(context.input, true);
    expect(context.runGeneration).toHaveBeenCalledTimes(1);
    expect(context.runGeneration).toHaveBeenCalledWith(expect.objectContaining({ question: context.input, documents: original, ticket: 'one-use-ticket' }));
    expect(cache.read('user-1')).toEqual(original);
    expect(JSON.stringify(context.saveConversation.mock.calls)).not.toContain('QA_END_987');
  });
  it('does not cache, persist or send a document after the pending reservation was cancelled', async () => {
    const { cache, context } = client();
    let release!: (ticket: string) => void;
    context.reserveAnswer.mockImplementationOnce(() => new Promise<string>(resolve => { release = resolve; }));
    const pending = actualCallback('submit', context)();
    context.promptIntentRevision.current += 1;
    context.reservationController.current?.abort();
    release('obsolete-ticket');
    await pending;
    expect(context.runGeneration).not.toHaveBeenCalled();
    expect(context.saveConversation).not.toHaveBeenCalled();
    expect(context.setDocuments).not.toHaveBeenCalled();
    expect(cache.read('user-1')).toBeUndefined();
    expect(context.submittingPrompt.current).toBeNull();
  });
});

describe('G-A06 document retry without silent evidence loss', () => {
  it('retries the original immutable document snapshot with a fresh reservation', async () => {
    const { cache, context } = client();
    cache.remember('user-1', context.documents);
    context.messages = [{ id: 'user-1', role: 'user', text: context.input, attachments: [{ name: 'Условия.docx' }] }, { role: 'assistant' }];
    context.documents[0].text = 'Replacement upload must not replace original evidence';
    await actualCallback('retry', context)(1);
    const request = (context.runGeneration.mock.calls[0] as unknown as [{ documents: ReturnType<typeof readDocumentContext>; ticket: string }])[0];
    expect(request.documents[0].text).toContain('QA_END_987');
    expect(request.ticket).toBe('one-use-ticket');
    expect(context.reserveAnswer).toHaveBeenCalledTimes(1);
  });
  it.each(['ru', 'en', 'zh'] as const)('asks to reattach in %s after text is no longer available, before reserving or deleting the old answer', async locale => {
    const { context } = client(); context.locale = locale;
    context.messages = [{ id: 'old-user', role: 'user', text: context.input, attachments: [{ name: 'old.docx' }] }, { role: 'assistant' }];
    await actualCallback('retry', context)(1);
    expect(context.setError).toHaveBeenCalledWith(DOCUMENT_CONTEXT_COPY[locale].missing);
    expect(context.setInput).toHaveBeenCalledWith(context.input);
    expect(context.reserveAnswer).not.toHaveBeenCalled();
    expect(context.runGeneration).not.toHaveBeenCalled();
    expect(context.setMessages).not.toHaveBeenCalled();
  });
  it('still retries a plain question without document context', async () => {
    const { context } = client([]);
    context.messages = [{ id: 'plain', role: 'user', text: context.input }, { role: 'assistant' }];
    await actualCallback('retry', context)(1);
    expect(context.reserveAnswer).toHaveBeenCalledTimes(1);
    expect(context.runGeneration).toHaveBeenCalledTimes(1);
  });
  it('bounds volatile history to eight document requests and supports explicit disposal', () => {
    const cache = new GektaDocumentRetryCache();
    for (let i = 0; i < 9; i++) cache.remember(`u-${i}`, [doc()]);
    expect(cache.read('u-0')).toBeUndefined();
    expect(cache.read('u-1')).toEqual([doc()]);
    cache.clear(); expect(cache.read('u-8')).toBeUndefined();
    expect(new GektaDocumentRetryCache().read('u-1')).toBeUndefined();
  });
});


describe('G-A06 actual document retry navigation regression', () => {
vi.mock('next/navigation', async (original) => ({ ...await original<typeof import('next/navigation')>(), useRouter:()=>({push:vi.fn()}) }));
const oldFetch=globalThis.fetch;
const evidence='Договор зерна. x < 12 && y > 3\n'+ 'я'.repeat(6000)+'\nINDEPENDENT_END_601';
const doc={id:'fixture-doc',name:'grain.txt',size:6200,mediaType:'text/plain',text:evidence,checksumSha256:'b'.repeat(64),truncated:false};
const envelope={legalVersion:'fake-test-version',consentCurrent:true,legalPresentation:{locale:'ru',snapshot:'synthetic-consent',termsHref:'/legal/usloviya-ispolzovaniya-gekta',privacyHref:'/legal/politika-konfidencialnosti'},entitlement:{state:'ANONYMOUS_FREE',canAsk:true,remaining:10,limit:10,serverTime:'2026-11-02T00:00:00Z',expiresAt:null}};
const json=(body:unknown)=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
function answer(){const streamId='review-integration';const frames:GatewayFrame[]=[{event:'meta',streamId,mode:'public',modelIdentity:null},{event:'token',streamId,text:'Проверь условия зернового договора.'},{event:'done',streamId,complete:true}];return new Response(frames.map(encodeFrame).join(''),{headers:{'content-type':'text/event-stream'}});}
function install(holdSecond=false){
 let reserves=0;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const spy=vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);
  if(url.includes('/api/gekta/account/'))return new Response('{}',{status:401});
  if(url.includes('/api/gekta/entitlement')){
   if(init?.method!=='POST')return json(envelope);
   const body=JSON.parse(String(init.body));
   if(body.action==='reserve'){reserves++;if(holdSecond&&reserves===2)await gate;return json({...envelope,allowed:true,ticket:'synthetic-ticket-'+reserves});}
   return json(envelope);
  }
  if(url==='/api/public-platform-assistant/attachments')return json({documents:[doc],rejected:[]});
  if(url.startsWith('/api/agro-chat'))return answer();
  throw new Error('Unexpected test fetch '+url);
 });
 Object.defineProperty(globalThis,'fetch',{configurable:true,writable:true,value:spy});
 return {spy,release,get reserves(){return reserves},get generations(){return spy.mock.calls.filter(([url])=>String(url).startsWith('/api/agro-chat'));}};
}
beforeEach(()=>{localStorage.clear();window.history.replaceState({},'','/gekta?chat=new');Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});});
afterEach(()=>{cleanup();Object.defineProperty(globalThis,'fetch',{configurable:true,writable:true,value:oldFetch});vi.restoreAllMocks();});
async function firstDocumentAnswer(server:ReturnType<typeof install>){
 render(createElement(GektaChatWorkspace));await act(async()=>{});
 const input=document.querySelector<HTMLInputElement>('input[type=file]')!;
 fireEvent.change(input,{target:{files:[new File(['fixture'],'grain.txt',{type:'text/plain'})]}});
 await screen.findByText('grain.txt');
 fireEvent.input(screen.getByRole('textbox'),{target:{value:'Разбери условия зернового договора.'}});
 fireEvent.click(screen.getByRole('button',{name:'Отправить'}));
 await screen.findByRole('button',{name:'Повторить'});
 expect(server.generations).toHaveLength(1);
 expect(JSON.parse(String(server.generations[0][1]?.body)).documents).toEqual([{name:doc.name,text:evidence,truncated:false}]);
}
describe('independent combined actual React interop',()=>{
 it('preserves the same full document on actual retry and keeps it out of local history',async()=>{
  const server=install();await firstDocumentAnswer(server);
  fireEvent.click(screen.getByRole('button',{name:'Повторить'}));
  await waitFor(()=>expect(server.generations).toHaveLength(2));
  const payload=JSON.parse(String(server.generations[1][1]?.body));
  expect(payload.documents).toEqual([{name:doc.name,text:evidence,truncated:false}]);
  expect(payload.message).toBe('Разбери условия зернового договора.');
  expect(JSON.stringify(localStorage)).not.toContain('INDEPENDENT_END_601');
 });
 it('does not revive a document retry after New Chat while its reservation is held',async()=>{
  const server=install(true);await firstDocumentAnswer(server);
  fireEvent.click(screen.getByRole('button',{name:'Повторить'}));
  await waitFor(()=>expect(server.reserves).toBe(2));
  fireEvent.click(document.querySelector<HTMLButtonElement>('[data-gekta-header-new-chat]')!);
  expect(screen.getByRole('textbox')).toHaveValue('');
  await act(async()=>server.release());
  await act(async()=>{});
  expect(server.generations).toHaveLength(1);
  expect(document.querySelectorAll('[data-gekta-role="user"]')).toHaveLength(0);
 });
 it('coalesces repeated Retry clicks into one reservation and cancels that request on New Chat',async()=>{
  const server=install(true);await firstDocumentAnswer(server);
  const retry=screen.getByRole('button',{name:'Повторить'});
  fireEvent.click(retry);fireEvent.click(retry);fireEvent.click(retry);
  await waitFor(()=>expect(server.reserves).toBe(2));
  const held=server.spy.mock.calls.filter(([url,init])=>String(url).includes('/api/gekta/entitlement')&&init?.method==='POST'&&JSON.parse(String(init.body)).action==='reserve')[1];
  fireEvent.click(document.querySelector<HTMLButtonElement>('[data-gekta-header-new-chat]')!);
  expect(held[1]?.signal?.aborted).toBe(true);
  await act(async()=>server.release());
  expect(server.generations).toHaveLength(1);
 });
 it('does not let a cancelled document retry overwrite the next conversation',async()=>{
  const server=install(true);await firstDocumentAnswer(server);
  fireEvent.click(screen.getByRole('button',{name:'Повторить'}));
  await waitFor(()=>expect(server.reserves).toBe(2));
  fireEvent.click(document.querySelector<HTMLButtonElement>('[data-gekta-header-new-chat]')!);
  fireEvent.input(screen.getByRole('textbox'),{target:{value:'Как хранить овёс в новом сезоне?'}});
  fireEvent.click(screen.getByRole('button',{name:'Отправить'}));
  await waitFor(()=>expect(server.generations).toHaveLength(2));
  const next=JSON.parse(String(server.generations[1][1]?.body));
  expect(next.message).toBe('Как хранить овёс в новом сезоне?');
  expect(next.documents).toEqual([]);
  await act(async()=>server.release());
  expect(server.generations).toHaveLength(2);
  expect(document.querySelectorAll('[data-gekta-role="user"]')).toHaveLength(1);
  expect(document.querySelector('[data-gekta-role="user"] p')?.textContent).toBe('Как хранить овёс в новом сезоне?');
 });
});

});
