import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { encodeFrame, type GatewayFrame } from '@pc/ai-assistant-stream-contract';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GektaChatWorkspace } from '@/components/gekta/GektaChatWorkspace';
import { GEKTA_SPEECH_LOCALES, pickVoice, transcriptFrom } from '@/lib/gekta/speech';
import { GEKTA_LEGAL_DOCUMENTS, GEKTA_LEGAL_VERSION, getGektaLegalDocument } from '@/lib/gekta/legal';
import { createAnonymousSession, parseAnonymousSession, recordConsent, serializeAnonymousSession } from '@/lib/gekta/anonymous-session';
import seoRoutes from '@/lib/platform-v7/public-seo-routes.json';

vi.mock('next/navigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/navigation')>(),
  useRouter: () => ({ push: vi.fn() }),
}));

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const voiceInput = read('components/gekta/GektaVoiceInput.tsx');
const speakButton = read('components/gekta/GektaSpeakButton.tsx');
const composer = read('components/gekta/GektaComposer.tsx');
const settings = read('components/gekta/GektaSettingsDialog.tsx');
const consent = read('components/gekta/GektaConsentDialog.tsx');
const workspace = read('components/gekta/GektaChatWorkspace.tsx');
const footer = read('components/gekta/GektaLegalFooter.tsx');
const legalRoute = read('app/legal/[slug]/page.tsx');

describe('Gekta voice', () => {
  it('uses browser-native speech only, with no paid service and no stored audio', () => {
    const speech = read('lib/gekta/speech.ts');
    expect(speech).toContain('webkitSpeechRecognition');
    expect(speech).toContain('speechSynthesis');
    for (const source of [speech, voiceInput, speakButton]) {
      expect(source).not.toMatch(/https?:\/\//u);
      expect(source).not.toContain('MediaRecorder');
      expect(source).not.toContain('FormData');
    }
    expect(GEKTA_SPEECH_LOCALES).toEqual({ ru: 'ru-RU', en: 'en-US', zh: 'zh-CN' });
  });

  it('covers the declared input states and shows the first-use notice before listening', () => {
    for (const state of ['unsupported', 'idle', 'permission', 'listening', 'processing', 'ready', 'error']) {
      expect(read('lib/gekta/speech.ts')).toContain(`'${state}'`);
    }
    expect(voiceInput).toContain("data-voice-state={state}");
    expect(voiceInput).toContain('Голосовой ввод преобразует вашу речь в текст для подготовки запроса. Аудио по умолчанию не сохраняется.');
    expect(voiceInput).toContain('Понятно, включить микрофон');
    expect(voiceInput).toContain('setNoticeOpen(true)');
    // Unsupported browsers simply do not render the control.
    expect(voiceInput).toContain("if (state === 'unsupported') return null;");
  });

  it('puts the transcript in the composer for editing instead of sending it', () => {
    expect(composer).toContain('onTranscript={(text) => {');
    expect(composer).toContain('onChange(value ? `${value.trim()} ${text}`.slice(0, 1200) : text.slice(0, 1200));');
    expect(composer).not.toContain('onTranscript={onSubmit}');
    expect(composer).toContain("role='status' aria-live='polite'");
  });

  it('offers playback with a stop control, a silent fallback and a 44px mobile target', () => {
    expect(speakButton).toContain('window.speechSynthesis.speak(utterance)');
    expect(speakButton).toContain('window.speechSynthesis.cancel()');
    expect(speakButton).toContain('if (!available) return null;');
    expect(speakButton).toContain('Прослушать');
    expect(speakButton).toContain('min-h-11');
    expect(speakButton).not.toContain('min-h-9');
    expect(transcriptFrom([{ 0: { transcript: 'посев  ' } }, { 0: { transcript: 'озимой' } }] as never)).toBe('посев озимой');
    const voices = [{ lang: 'en-US' }, { lang: 'ru-RU' }] as SpeechSynthesisVoice[];
    expect(pickVoice(voices, 'ru')?.lang).toBe('ru-RU');
    expect(pickVoice([{ lang: 'ru' }] as SpeechSynthesisVoice[], 'ru')?.lang).toBe('ru');
    expect(pickVoice([], 'zh')).toBeUndefined();
  });

  it('exposes voice switches in settings only where the browser supports them', () => {
    expect(settings).toContain('{ui.voice}');
    expect(settings).toContain('setSpeechCapable(recognition !== null || speechSynthesisAvailable())');
    expect(settings).toContain('{ui.voiceUnsupported}');
    expect(workspace).toContain('const changeVoiceInput = React.useCallback(');
    expect(workspace).toContain('const changeVoiceOutput = React.useCallback(');
    expect(workspace).toContain('voiceEnabled={voiceInputEnabled}');
    expect(workspace).toContain('speechEnabled={speechEnabled}');
  });
});

describe('Gekta legal surface', () => {
  it('shows one compact notice and records the accepted document version server-side', () => {
    expect(consent).toContain('Перед началом');
    expect(consent).toContain('Гекта использует искусственный интеллект');
    expect(consent).toContain('Понятно, начать');
    expect(consent).toContain("termsHref = '/legal/usloviya-ispolzovaniya-gekta'");
    expect(consent).toContain("privacyHref = '/legal/politika-konfidencialnosti'");
    expect(workspace).toContain("noticeSnapshot: legalPresentation.snapshot");
    expect(workspace).toContain('setConsentRequired(body.consentCurrent !== true);');
  });

  it('does not let a late consent probe steal active composer focus or submit before acceptance', () => {
    expect(consent).toContain('function activeDraftAtMount()');
    expect(consent).toContain('document.activeElement === composer || composer.value.trim().length > 0');
    expect(consent).toContain('const [deferred, setDeferred] = React.useState(activeDraftAtMount);');
    expect(consent).toContain("document.addEventListener('keydown', onKeyDown, true)");
    expect(consent).toContain("document.addEventListener('click', onClick, true)");
    expect(consent).toContain("target.closest(\"[data-gekta-submit='true']\")");
    expect(composer).toContain("data-gekta-submit='true'");
    expect(consent).toContain('const panelRef = useDialogFocus(!deferred, ignoreEscape);');
    expect(consent).not.toContain('useDialogFocus(true, onAccept)');
  });

  it('binds a consent record to the session, the version and the server clock', () => {
    const session = createAnonymousSession(new Date('2026-08-12T10:00:00Z'));
    const accepted = recordConsent(session, GEKTA_LEGAL_VERSION, new Date('2026-08-12T10:05:00Z'));
    expect(accepted.consent).toEqual({ version: GEKTA_LEGAL_VERSION, at: Date.parse('2026-08-12T10:05:00Z') });
    const roundTripped = parseAnonymousSession(serializeAnonymousSession(accepted));
    expect(roundTripped?.consent?.version).toBe(GEKTA_LEGAL_VERSION);
    expect(roundTripped?.sid).toBe(session.sid);
  });

  it('publishes readable documents that neither overclaim nor disclaim everything', () => {
    expect(GEKTA_LEGAL_DOCUMENTS.length).toBeGreaterThanOrEqual(4);
    for (const document of GEKTA_LEGAL_DOCUMENTS) {
      expect(document.sections.length).toBeGreaterThanOrEqual(3);
      expect(getGektaLegalDocument(document.slug)?.title).toBe(document.title);
      const text = document.sections.flatMap((section) => section.paragraphs).join(' ');
      expect(text).not.toMatch(/не несёт никакой ответственности|ни за что не отвечает/u);
    }
    const terms = getGektaLegalDocument('usloviya-ispolzovaniya-gekta');
    const combined = terms!.sections.flatMap((section) => section.paragraphs).join(' ');
    expect(combined).toContain('не исключает ответственность в случаях, когда закон этого не допускает');
    expect(combined).toContain('не выполняет поиск в интернете в реальном времени');
  });

  it('links the documents from the product footer and publishes them for crawlers', () => {
    expect(footer).toContain('GEKTA_LEGAL_DOCUMENTS.map(');
    expect(footer).toContain("href={`${GEKTA_PATHS[locale]}/support`}");
    expect(footer).toContain('{ui.pending}');
    expect(legalRoute).toContain('generateStaticParams');
    expect(legalRoute).toContain('alternates: { canonical: `/legal/${document.slug}` }');
    const paths = new Set(seoRoutes.routes.map((route) => route.path));
    for (const document of GEKTA_LEGAL_DOCUMENTS) {
      expect(paths.has(`/legal/${document.slug}`)).toBe(true);
    }
  });
});

describe('Gekta interface language inheritance', () => {
  it.each([
    { locale: 'ru' as const, language: 'ru', menu: 'Открыть историю' },
    { locale: 'en' as const, language: 'en', menu: 'Open history' },
    { locale: 'zh' as const, language: 'zh-CN', menu: '打开历史记录' },
  ])('declares $language for the actual $locale workspace under Russian platform chrome', ({ locale, language, menu }) => {
    const chrome = document.createElement('div');
    chrome.lang = 'ru';
    chrome.innerHTML = renderToStaticMarkup(createElement(GektaChatWorkspace, { locale }));
    const region = chrome.querySelector<HTMLElement>('[data-gekta-chat-workspace]');
    expect(region).not.toBeNull();
    expect(region!.lang).toBe(language);
    const menuButton = Array.from(region!.querySelectorAll('button')).find(button => button.getAttribute('aria-label') === menu);
    expect(menuButton).toBeDefined();
    expect(menuButton!.closest('[lang]')?.getAttribute('lang')).toBe(language);
    const composer = region!.querySelector('textarea');
    expect(composer).not.toBeNull();
    expect(composer!.closest('[lang]')?.getAttribute('lang')).toBe(language);
    expect(chrome.lang).toBe('ru');
  });
});

// Behavioral coverage runs in the existing CI-executed consent suite.
describe('G-A02 first prompt behavioral regressions', () => {
const QUESTION = 'Как подготовить почву под пшеницу?';
const originalFetch = globalThis.fetch;
const legalPresentation = {
  locale: 'ru', snapshot: 'synthetic-ui-notice',
  termsHref: '/legal/test-terms', privacyHref: '/legal/test-privacy',
};
const entitlement = { state: 'ANONYMOUS_FREE', canAsk: true, remaining: 10, limit: 10, serverTime: '2026-11-01T00:00:00Z', expiresAt: null };
const envelope = (consentCurrent: boolean) => ({ legalVersion: 'synthetic-test-version', consentCurrent, legalPresentation, entitlement });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function stream() {
  const streamId = 'stream-consent-test';
  const frames: GatewayFrame[] = [
    { event: 'meta', streamId, mode: 'public', modelIdentity: null },
    { event: 'token', streamId, text: 'Сначала уточни тип почвы.' },
    { event: 'done', streamId, complete: true },
  ];
  return new Response(frames.map(encodeFrame).join(''), { headers: { 'content-type': 'text/event-stream' } });
}
function installServer(options: { consentFails?: boolean; reserveFails?: boolean; delayedProbe?: Promise<Response>; reserveGate?: Promise<void>; firstReserveGate?: Promise<void>; completeGate?: Promise<void>; generation?: (init: RequestInit | undefined, ordinal: number) => Response | Promise<Response> } = {}) {
  let accepted = false;
  let reserveCount = 0;
  let ticketCount = 0;
  let generationCount = 0;
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/gekta/account/')) return json({}, 401);
    if (url.includes('/api/gekta/entitlement')) {
      if (init?.method !== 'POST') return options.delayedProbe ?? json(envelope(false));
      const body = JSON.parse(String(init.body));
      if (body.action === 'consent') {
        if (options.consentFails) return json(envelope(false), 503);
        accepted = true;
        return json(envelope(true));
      }
      if (body.action === 'reserve') {
        const reservation = accepted ? { ...envelope(true), allowed: true, ticket: `synthetic-ticket-${++ticketCount}` } : { ...envelope(false), allowed: false, reason: 'consent_required' };
        if (options.firstReserveGate && reserveCount++ === 0) await options.firstReserveGate;
        if (options.reserveGate) await options.reserveGate;
        if (options.reserveFails) return json({}, 503);
        return json(reservation);
      }
      if (body.action === 'complete' && options.completeGate) await options.completeGate;
      return json(envelope(accepted));
    }
    if (url === '/api/public-platform-assistant/attachments') return json({ documents: [{ id: 'synthetic-doc', name: 'soil.txt', size: 50, mediaType: 'text/plain', text: 'Почва суглинок. QA_SOIL_DOC_754.', checksumSha256: 'a'.repeat(64), truncated: false }], rejected: [] });
    if (url.startsWith('/api/agro-chat')) return options.generation?.(init, generationCount++) ?? stream();
    throw new Error(`Unexpected test network ${url}`);
  });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: spy });
  return spy;
}
const generations = (spy: ReturnType<typeof installServer>) => spy.mock.calls.filter(([url]) => String(url).startsWith('/api/agro-chat'));
const consentWrites = (spy: ReturnType<typeof installServer>) => spy.mock.calls.filter(([url, init]) => String(url).startsWith('/api/gekta/entitlement') && init?.method === 'POST' && JSON.parse(String(init.body)).action === 'consent');
async function draft() {
  render(createElement(GektaChatWorkspace, { discoveryHero: createElement('h1', null, 'Гекта') }));
  const box = screen.getByRole('textbox');
  fireEvent.input(box, { target: { value: QUESTION } });
  await act(async () => {});
  return box;
}
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/gekta');
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
  vi.restoreAllMocks();
});

describe('G-A02 first manual question from discovery', () => {
  it.each(['click', 'enter'])('reveals consent on the first %s and resumes exactly once only after confirmation', async (intent) => {
    const spy = installServer();
    const box = await draft();
    expect(screen.queryByRole('dialog')).toBeNull();
    if (intent === 'click') fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    else fireEvent.keyDown(box, { key: 'Enter', code: 'Enter' });
    const dialog = await screen.findByRole('dialog', { name: 'Перед началом' });
    expect(dialog).toBeTruthy();
    expect(screen.getByRole('textbox')).toHaveValue(QUESTION);
    expect(generations(spy)).toHaveLength(0);
    expect(consentWrites(spy)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно, начать' }));
    await waitFor(() => expect(generations(spy)).toHaveLength(1));
    expect(JSON.parse(String(generations(spy)[0][1]?.body)).message).toBe(QUESTION);
    expect(consentWrites(spy)).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('keeps a failed confirmation visible and never starts generation', async () => {
    const spy = installServer({ consentFails: true });
    await draft();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Понятно, начать' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить подтверждение');
    expect(screen.getByRole('textbox')).toHaveValue(QUESTION);
    expect(generations(spy)).toHaveLength(0);
  });
  it('shows a visible access error without losing the draft when reserve fails', async () => {
    const spy = installServer({ reserveFails: true });
    await draft();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось проверить доступ');
    expect(screen.getByRole('textbox')).toHaveValue(QUESTION);
    expect(generations(spy)).toHaveLength(0);
  });
  it('coalesces rapid first clicks while reserve is pending', async () => {
    let release!: () => void;
    const spy = installServer({ reserveGate: new Promise<void>((resolve) => { release = resolve; }) });
    await draft();
    const send = screen.getByRole('button', { name: 'Отправить' });
    fireEvent.click(send); fireEvent.click(send); fireEvent.click(send);
    await act(async () => release());
    await screen.findByRole('dialog');
    const reserves = spy.mock.calls.filter(([url, init]) => String(url).startsWith('/api/gekta/entitlement') && init?.method === 'POST' && JSON.parse(String(init.body)).action === 'reserve');
    expect(reserves).toHaveLength(1);
    expect(generations(spy)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно, начать' }));
    await waitFor(() => expect(generations(spy)).toHaveLength(1));
  });
  it('resumes a deferred intent in chat=new after a late probe without stealing typing focus', async () => {
    let release!: (response: Response) => void;
    const spy = installServer({ delayedProbe: new Promise<Response>((resolve) => { release = resolve; }) });
    window.history.replaceState({}, '', '/gekta?chat=new');
    await draft();
    const box = screen.getByRole('textbox');
    box.focus();
    expect(document.activeElement).toBe(box);
    await act(async () => release(json(envelope(false))));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(box);
    fireEvent.keyDown(box, { key: 'Enter', code: 'Enter' });
    await screen.findByRole('dialog');
    expect(generations(spy)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно, начать' }));
    await waitFor(() => expect(generations(spy)).toHaveLength(1));
    expect(JSON.parse(String(generations(spy)[0][1]?.body)).message).toBe(QUESTION);
  });
  it('ignores the older initial consent probe after a confirmed submission', async () => {
    let release!: (response: Response) => void;
    const spy = installServer({ delayedProbe: new Promise<Response>((resolve) => { release = resolve; }) });
    await draft();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Понятно, начать' }));
    await waitFor(() => expect(generations(spy)).toHaveLength(1));
    const initialProbe = spy.mock.calls.find(([url, init]) => String(url).startsWith('/api/gekta/entitlement') && init?.method !== 'POST');
    expect(initialProbe?.[1]?.signal?.aborted).toBe(true);
    await act(async () => release(json(envelope(false))));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(generations(spy)).toHaveLength(1);
  });
  it('never resumes a cancelled first question after New Chat while reserve is pending', async () => {
    let release!: () => void;
    const spy = installServer({ reserveGate: new Promise<void>((resolve) => { release = resolve; }) });
    await draft();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    const headerNew = document.querySelector<HTMLButtonElement>('[data-gekta-header-new-chat]')!;
    fireEvent.click(headerNew);
    expect(screen.getByRole('textbox')).toHaveValue('');
    await act(async () => release());
    const accept = screen.queryByRole('button', { name: 'Понятно, начать' });
    if (accept) {
      fireEvent.click(accept);
      await waitFor(() => expect(consentWrites(spy)).toHaveLength(1));
    }
    await act(async () => {});
    expect(generations(spy)).toHaveLength(0);
  });
  it.each(['', '   '])('resumes an attachment-only deferred submit with the same extracted document (draft=%j)', async (emptyDraft) => {
    let release!: (response: Response) => void;
    const spy = installServer({ delayedProbe: new Promise<Response>((resolve) => { release = resolve; }) });
    window.history.replaceState({}, '', '/gekta?chat=new');
    render(createElement(GektaChatWorkspace, { discoveryHero: createElement('h1', null, 'Гекта') }));
    await act(async () => {});
    const fileInput = document.querySelector<HTMLInputElement>('[data-gekta-drop-target] input[type=file]')!;
    fireEvent.change(fileInput, { target: { files: [new File(['Почва суглинок'], 'soil.txt', { type: 'text/plain' })] } });
    await screen.findByText('soil.txt');
    const box = screen.getByRole('textbox');
    if (emptyDraft) fireEvent.input(box, { target: { value: emptyDraft } });
    box.focus();
    expect(document.activeElement).toBe(box);
    await act(async () => release(json(envelope(false))));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await screen.findByRole('dialog');
    expect(generations(spy)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно, начать' }));
    await waitFor(() => expect(generations(spy)).toHaveLength(1));
    const payload = JSON.parse(String(generations(spy)[0][1]?.body));
    expect(payload.message).toBe('Проанализируй приложенные материалы.');
    expect(payload.documents).toEqual([{ name: 'soil.txt', text: 'Почва суглинок. QA_SOIL_DOC_754.', truncated: false }]);
    expect(payload.message).not.toContain('QA_SOIL_DOC_754');
    expect(JSON.stringify(localStorage)).not.toContain('QA_SOIL_DOC_754');
  });
  it('does not let a cancelled old reservation roll back a newer confirmed question', async () => {
    let release!: () => void;
    const spy = installServer({ firstReserveGate: new Promise<void>((resolve) => { release = resolve; }) });
    await draft();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-gekta-header-new-chat]')!);
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'Как хранить овёс?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Понятно, начать' }));
    await waitFor(() => expect(generations(spy)).toHaveLength(1));
    const firstReserve = spy.mock.calls.find(([url, init]) => String(url).startsWith('/api/gekta/entitlement') && init?.method === 'POST' && JSON.parse(String(init.body)).action === 'reserve');
    expect(firstReserve?.[1]?.signal?.aborted).toBe(true);
    await act(async () => release());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(generations(spy)).toHaveLength(1);
    expect(JSON.parse(String(generations(spy)[0][1]?.body)).message).toBe('Как хранить овёс?');
  });
  it.each(['network', '401', '503'])('does not replay an uncertain one-use generation after %s; explicit Retry obtains a fresh ticket and document', async failure => {
    const spy = installServer({ generation: (_init, ordinal) => {
      if (ordinal > 0) return stream();
      if (failure === 'network') throw new TypeError('synthetic response lost after ticket admission');
      return json({}, Number(failure));
    } });
    await draft();
    const fileInput = document.querySelector<HTMLInputElement>('[data-gekta-drop-target] input[type=file]')!;
    fireEvent.change(fileInput, { target: { files: [new File(['Почва суглинок'], 'soil.txt', { type: 'text/plain' })] } });
    await screen.findByText('soil.txt');
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Понятно, начать' }));
    const retryButton = await screen.findByRole('button', { name: 'Повторить' });
    expect(generations(spy)).toHaveLength(1);
    const first = generations(spy)[0][1]!;
    expect(new Headers(first.headers).get('x-gekta-answer-ticket')).toBe('synthetic-ticket-1');
    expect(spy.mock.calls.filter(([url, init]) => String(url).includes('/api/gekta/entitlement') && init?.method === 'POST' && JSON.parse(String(init.body)).action === 'complete')).toHaveLength(0);
    fireEvent.click(retryButton);
    await screen.findByText('Сначала уточни тип почвы.');
    await waitFor(() => expect(generations(spy)).toHaveLength(2));
    const second = generations(spy)[1][1]!;
    expect(new Headers(second.headers).get('x-gekta-answer-ticket')).toBe('synthetic-ticket-2');
    for (const init of [first, second]) {
      expect(JSON.parse(String(init.body))).toMatchObject({ message: QUESTION, documents: [{ name: 'soil.txt', text: 'Почва суглинок. QA_SOIL_DOC_754.', truncated: false }] });
    }
    await waitFor(() => {
      const completions = spy.mock.calls.filter(([url, init]) => String(url).includes('/api/gekta/entitlement') && init?.method === 'POST' && JSON.parse(String(init.body)).action === 'complete');
      expect(completions).toHaveLength(1);
      expect(JSON.parse(String(completions[0][1]?.body)).ticket).toBe('synthetic-ticket-2');
    });
    expect(JSON.stringify(localStorage)).not.toContain('QA_SOIL_DOC_754');
  });

  it('aborts one pending generation on Stop without replay or completion and exposes Retry', async () => {
    let signal: AbortSignal | undefined;
    const spy = installServer({ generation: init => new Promise<Response>((_resolve, reject) => {
      signal = init?.signal ?? undefined;
      signal?.addEventListener('abort', () => reject(new DOMException('stopped', 'AbortError')), { once: true });
    }) });
    await draft();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Понятно, начать' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Остановить' }));
    await screen.findByRole('button', { name: 'Повторить' });
    expect(signal?.aborted).toBe(true);
    expect(generations(spy)).toHaveLength(1);
    expect(spy.mock.calls.filter(([url, init]) => String(url).includes('/api/gekta/entitlement') && init?.method === 'POST' && JSON.parse(String(init.body)).action === 'complete')).toHaveLength(0);
  });

  it.each(['late-success', 'never-headers'])('waits beyond ninety seconds while retaining a finite overall deadline: %s', async mode => {
    let signal: AbortSignal | undefined;
    const spy = installServer({ generation: init => new Promise<Response>((resolve, reject) => {
      signal = init?.signal ?? undefined;
      if (mode === 'late-success') window.setTimeout(() => resolve(stream()), 100_000);
      signal?.addEventListener('abort', () => reject(new DOMException('deadline', 'AbortError')), { once: true });
    }) });
    await draft();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    const confirm = await screen.findByRole('button', { name: 'Понятно, начать' });
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(confirm); });
    expect(generations(spy)).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(90_001); });
    expect(signal?.aborted).toBe(false);
    if (mode === 'late-success') {
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      expect(screen.getByText('Сначала уточни тип почвы.')).toBeTruthy();
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(signal?.aborted).toBe(false);
    } else {
      await act(async () => { await vi.advanceTimersByTimeAsync(59_998); });
      expect(signal?.aborted).toBe(false);
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(signal?.aborted).toBe(true);
      expect(screen.getByRole('button', { name: 'Повторить' })).toBeTruthy();
    }
    expect(generations(spy)).toHaveLength(1);
    const completed = spy.mock.calls.filter(([url, init]) => String(url).includes('/api/gekta/entitlement') && init?.method === 'POST' && JSON.parse(String(init.body)).action === 'complete');
    expect(completed).toHaveLength(mode === 'late-success' ? 1 : 0);
  });

  it('labels a stalled partial stream at the overall deadline as timeout, without claiming the user pressed Stop', async () => {
    let signal: AbortSignal | undefined;
    let bodyCancelled = false;
    const spy = installServer({ generation: init => new Promise<Response>(resolve => {
      signal = init?.signal ?? undefined;
      window.setTimeout(() => {
        const streamId = 'synthetic-stalled-partial';
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode([
              { event: 'meta', streamId, mode: 'public', modelIdentity: null },
              { event: 'token', streamId, text: 'Незавершённый синтетический ответ.' },
            ].map(frame => encodeFrame(frame as GatewayFrame)).join('')));
          },
          cancel() { bodyCancelled = true; },
        });
        resolve(new Response(body, { headers: { 'content-type': 'text/event-stream' } }));
      }, 10_000);
    }) });
    await draft();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    const confirm = await screen.findByRole('button', { name: 'Понятно, начать' });
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(confirm); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByText('Незавершённый синтетический ответ.')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(139_999); });
    expect(signal?.aborted).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(signal?.aborted).toBe(true);
    expect(bodyCancelled).toBe(true);
    expect(screen.getAllByText('Время ожидания ответа истекло. Повтори запрос.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ответ остановлен.')).toBeNull();
    expect(screen.queryByText('Незавершённый синтетический ответ.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeTruthy();
    expect(generations(spy)).toHaveLength(1);
    const completed = spy.mock.calls.filter(([url, init]) => String(url).includes('/api/gekta/entitlement') && init?.method === 'POST' && JSON.parse(String(init.body)).action === 'complete');
    expect(completed).toHaveLength(0);
    const stored = JSON.stringify(localStorage);
    expect(stored).toContain('UPSTREAM_ERROR');
    expect(stored).not.toContain('CANCELLED');
  });

  it('disarms the completed generation deadline while its separate completion acknowledgement is pending', async () => {
    let release!: () => void;
    let signal: AbortSignal | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const spy = installServer({ completeGate: gate, generation: init => {
      signal = init?.signal ?? undefined;
      return stream();
    } });
    await draft();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    const confirm = await screen.findByRole('button', { name: 'Понятно, начать' });
    vi.useFakeTimers();
    try {
      await act(async () => { fireEvent.click(confirm); });
      expect(screen.getByText('Сначала уточни тип почвы.')).toBeTruthy();
      const completed = spy.mock.calls.filter(([url, init]) => String(url).includes('/api/gekta/entitlement') && init?.method === 'POST' && JSON.parse(String(init.body)).action === 'complete');
      expect(completed).toHaveLength(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(160_000); });
      expect(signal?.aborted).toBe(false);
      expect(generations(spy)).toHaveLength(1);
      expect(JSON.stringify(localStorage)).toContain('answered');
      expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull();
    } finally { await act(async () => release()); }
  });

  it('uses the reserve notice when the initial probe is still pending', async () => {
    const spy = installServer({ delayedProbe: new Promise<Response>(() => {}) });
    await draft();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await screen.findByRole('dialog', { name: 'Перед началом' });
    expect(generations(spy)).toHaveLength(0);
  });
});

});
