'use client';

import * as React from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import type { GektaLocale } from '@/lib/gekta/content';
import { createSpeechRecognition, transcriptFrom, type SpeechInputState, type SpeechRecognitionLike } from '@/lib/gekta/speech';
import { useDialogFocus } from './useDialogFocus';

export const GEKTA_VOICE_CONSENT_STORAGE = 'gekta-voice-consent-v1';

const UI = {
  ru: {
    start: 'Голосовой ввод',
    stop: 'Остановить запись',
    listening: 'Слушаю…',
    processing: 'Распознаю…',
    permission: 'Запрашиваю доступ к микрофону…',
    ready: 'Текст распознан — проверьте и отправьте',
    denied: 'Доступ к микрофону не разрешён. Проверьте настройки браузера.',
    failed: 'Не удалось распознать речь. Попробуйте ещё раз.',
    noticeTitle: 'Голосовой ввод',
    noticeBody: 'Голосовой ввод преобразует вашу речь в текст для подготовки запроса. Аудио по умолчанию не сохраняется.',
    noticeCta: 'Понятно, включить микрофон',
    noticeCancel: 'Не сейчас',
  },
  en: {
    start: 'Voice input',
    stop: 'Stop recording',
    listening: 'Listening…',
    processing: 'Transcribing…',
    permission: 'Requesting microphone access…',
    ready: 'Text recognised — check it and send',
    denied: 'Microphone access was not granted. Check your browser settings.',
    failed: 'Speech could not be recognised. Please try again.',
    noticeTitle: 'Voice input',
    noticeBody: 'Voice input turns your speech into text so you can prepare a request. Audio is not stored by default.',
    noticeCta: 'Got it, enable the microphone',
    noticeCancel: 'Not now',
  },
  zh: {
    start: '语音输入',
    stop: '停止录音',
    listening: '正在聆听…',
    processing: '正在识别…',
    permission: '正在请求麦克风权限…',
    ready: '已识别文本 — 请检查后发送',
    denied: '未获得麦克风权限。请检查浏览器设置。',
    failed: '未能识别语音，请重试。',
    noticeTitle: '语音输入',
    noticeBody: '语音输入会把您的语音转换为文本，用于撰写请求。默认不保存音频。',
    noticeCta: '知道了，开启麦克风',
    noticeCancel: '暂不开启',
  },
} as const;

function VoiceNotice({ locale, onAccept, onCancel }: { locale: GektaLocale; onAccept: () => void; onCancel: () => void }) {
  const ui = UI[locale];
  const panelRef = useDialogFocus(true, onCancel);
  return (
    <div className='fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4'>
      <div ref={panelRef} role='dialog' aria-modal='true' aria-labelledby='gekta-voice-notice-title' data-gekta-voice-notice='true' className='w-full rounded-t-3xl bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl sm:pb-5'>
        <h2 id='gekta-voice-notice-title' className='text-base font-semibold text-slate-950'>{ui.noticeTitle}</h2>
        <p className='mt-2 text-sm leading-6 text-slate-600'>{ui.noticeBody}</p>
        <div className='mt-5 flex flex-col gap-2 sm:flex-row'>
          <button type='button' onClick={onAccept} className='min-h-11 flex-1 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>{ui.noticeCta}</button>
          <button type='button' onClick={onCancel} className='min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50'>{ui.noticeCancel}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Speech is only ever turned into editable text. The transcript lands in the
 * composer and the person decides whether to send it — nothing is submitted
 * automatically.
 */
export function GektaVoiceInput({ locale, disabled, onTranscript, onStatus }: {
  locale: GektaLocale;
  disabled: boolean;
  onTranscript: (text: string) => void;
  onStatus: (message: string) => void;
}) {
  const ui = UI[locale];
  const [state, setState] = React.useState<SpeechInputState>('idle');
  const [noticeOpen, setNoticeOpen] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const supported = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    const probe = createSpeechRecognition(locale);
    supported.current = probe !== null;
    if (!probe) setState('unsupported');
    probe?.abort?.();
    return () => { recognitionRef.current?.abort?.(); recognitionRef.current = null; };
  }, [locale]);

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const listen = React.useCallback(() => {
    const recognition = createSpeechRecognition(locale);
    if (!recognition) {
      setState('unsupported');
      return;
    }
    recognitionRef.current = recognition;
    setState('permission');
    onStatus(ui.permission);

    recognition.onstart = () => {
      setState('listening');
      onStatus(ui.listening);
    };
    recognition.onresult = (event) => {
      const text = transcriptFrom(event.results);
      if (!text) return;
      setState('processing');
      onTranscript(text);
    };
    recognition.onerror = (event) => {
      setState('error');
      onStatus(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? ui.denied : ui.failed);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setState((current) => {
        if (current === 'error' || current === 'unsupported') return current;
        onStatus(ui.ready);
        return 'ready';
      });
    };

    try {
      recognition.start();
    } catch {
      setState('error');
      onStatus(ui.failed);
    }
  }, [locale, onStatus, onTranscript, ui.denied, ui.failed, ui.listening, ui.permission, ui.ready]);

  const activate = React.useCallback(() => {
    let accepted = false;
    try { accepted = window.localStorage.getItem(GEKTA_VOICE_CONSENT_STORAGE) === 'accepted'; } catch {}
    if (!accepted) {
      setNoticeOpen(true);
      return;
    }
    listen();
  }, [listen]);

  // A browser without speech recognition simply keeps the typed composer.
  if (state === 'unsupported') return null;

  const active = state === 'listening' || state === 'permission';

  return (
    <>
      <button
        type='button'
        onClick={active ? stop : activate}
        disabled={disabled}
        aria-label={active ? ui.stop : ui.start}
        title={active ? ui.stop : ui.start}
        aria-pressed={active}
        data-gekta-voice-input='true'
        data-voice-state={state}
        className={`flex h-11 w-11 items-center justify-center rounded-xl border text-slate-600 transition disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${active ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
      >
        {state === 'processing' ? <Loader2 className='h-4 w-4 animate-spin motion-reduce:animate-none' aria-hidden='true' /> : active ? <Square className='h-3.5 w-3.5 fill-current' aria-hidden='true' /> : <Mic className='h-4 w-4' aria-hidden='true' />}
      </button>
      {noticeOpen ? (
        <VoiceNotice
          locale={locale}
          onAccept={() => {
            try { window.localStorage.setItem(GEKTA_VOICE_CONSENT_STORAGE, 'accepted'); } catch {}
            setNoticeOpen(false);
            listen();
          }}
          onCancel={() => setNoticeOpen(false)}
        />
      ) : null}
    </>
  );
}
