import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GEKTA_SPEECH_LOCALES, pickVoice, transcriptFrom } from '@/lib/gekta/speech';
import { GEKTA_LEGAL_DOCUMENTS, GEKTA_LEGAL_VERSION, getGektaLegalDocument } from '@/lib/gekta/legal';
import { createAnonymousSession, parseAnonymousSession, recordConsent, serializeAnonymousSession } from '@/lib/gekta/anonymous-session';
import seoRoutes from '@/lib/platform-v7/public-seo-routes.json';

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
    expect(consent).toContain("href='/legal/usloviya-ispolzovaniya-gekta'");
    expect(consent).toContain("href='/legal/politika-konfidencialnosti'");
    expect(workspace).toContain("body: JSON.stringify({ action: 'consent' })");
    expect(workspace).toContain('setConsentRequired(body.consent?.version !== body.legalVersion);');
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
    expect(footer).toContain("href='/platform-v7/contact'");
    expect(footer).toContain('{ui.pending}');
    expect(legalRoute).toContain('generateStaticParams');
    expect(legalRoute).toContain('alternates: { canonical: `/legal/${document.slug}` }');
    const paths = new Set(seoRoutes.routes.map((route) => route.path));
    for (const document of GEKTA_LEGAL_DOCUMENTS) {
      expect(paths.has(`/legal/${document.slug}`)).toBe(true);
    }
  });
});
