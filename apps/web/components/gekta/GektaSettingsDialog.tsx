'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';
import { createSpeechRecognition, speechSynthesisAvailable } from '@/lib/gekta/speech';
import { GektaPhoneCard } from './GektaPhoneCard';
import { useDialogFocus } from './useDialogFocus';

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className='mt-3 flex items-start gap-3'>
      <input
        id={id}
        type='checkbox'
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className='mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
      />
      <label htmlFor={id} className='min-w-0'>
        <span className='block text-sm font-medium text-slate-800'>{label}</span>
        <span className='mt-0.5 block text-xs leading-5 text-slate-500'>{hint}</span>
      </label>
    </div>
  );
}

export type GektaAnswerLocale = 'auto' | GektaLocale;

const UI = {
  ru: {
    title: 'Настройки',
    close: 'Закрыть настройки',
    interface: 'Интерфейс',
    interfaceHint: 'Язык интерфейса Гекты. Переключение открывает соответствующий адрес продукта.',
    answers: 'Ответы',
    answerLanguage: 'Язык ответа',
    answerAuto: 'Как интерфейс',
    answerHint: 'Гекта отвечает на выбранном языке. «Как интерфейс» — язык страницы.',
    voice: 'Голос',
    voiceInput: 'Голосовой ввод',
    voiceInputHint: 'Кнопка микрофона в поле ввода. Речь преобразуется в текст средствами браузера, аудио не сохраняется.',
    voiceOutput: 'Озвучивание ответов',
    voiceOutputHint: 'Кнопка «Прослушать» под ответом Гекты. Используется синтез речи браузера.',
    voiceUnsupported: 'Браузер не поддерживает эту функцию — обычный чат работает без неё.',
    history: 'История и приватность',
    historyHint: 'История анонимного режима хранится только в этом браузере и не передаётся вместе с аналитикой.',
    clear: 'Удалить историю в этом браузере',
    languages: { ru: 'Русский', en: 'English', zh: '中文' },
  },
  en: {
    title: 'Settings',
    close: 'Close settings',
    interface: 'Interface',
    interfaceHint: 'Gekta interface language. Switching opens the matching product address.',
    answers: 'Answers',
    answerLanguage: 'Answer language',
    answerAuto: 'Follow interface',
    answerHint: 'Gekta answers in the selected language. "Follow interface" uses the page language.',
    voice: 'Voice',
    voiceInput: 'Voice input',
    voiceInputHint: 'A microphone button in the composer. Speech is turned into text by the browser and audio is not stored.',
    voiceOutput: 'Read answers aloud',
    voiceOutputHint: 'A "Listen" button under a Gekta answer, using the browser\u2019s own speech synthesis.',
    voiceUnsupported: 'This browser does not support the feature — the normal chat works without it.',
    history: 'History and privacy',
    historyHint: 'Anonymous history is stored only in this browser and is never sent with analytics.',
    clear: 'Delete history in this browser',
    languages: { ru: 'Русский', en: 'English', zh: '中文' },
  },
  zh: {
    title: '设置',
    close: '关闭设置',
    interface: '界面',
    interfaceHint: 'Gekta 的界面语言。切换后会打开对应的产品地址。',
    answers: '回答',
    answerLanguage: '回答语言',
    answerAuto: '跟随界面',
    answerHint: 'Gekta 会使用所选语言回答。“跟随界面”表示使用页面语言。',
    voice: '语音',
    voiceInput: '语音输入',
    voiceInputHint: '输入框中的麦克风按钮。由浏览器将语音转为文本，不保存音频。',
    voiceOutput: '朗读回答',
    voiceOutputHint: 'Gekta 回答下方的“朗读”按钮，使用浏览器自带的语音合成。',
    voiceUnsupported: '此浏览器不支持该功能 — 普通聊天不受影响。',
    history: '历史与隐私',
    historyHint: '匿名历史记录仅保存在此浏览器中，且不会随分析数据发送。',
    clear: '删除此浏览器中的历史记录',
    languages: { ru: 'Русский', en: 'English', zh: '中文' },
  },
} as const;

/**
 * Only settings that work end to end are shown. Appearance, voice and
 * subscription controls appear here when the feature behind them is real.
 */
export function GektaSettingsDialog({ locale, answerLocale, hasHistory, voiceInputEnabled, voiceOutputEnabled, extraSections, onAnswerLocale, onVoiceInput, onVoiceOutput, onLocale, onClearHistory, onClose }: {
  locale: GektaLocale;
  answerLocale: GektaAnswerLocale;
  hasHistory: boolean;
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  extraSections?: React.ReactNode;
  onAnswerLocale: (value: GektaAnswerLocale) => void;
  onVoiceInput: (enabled: boolean) => void;
  onVoiceOutput: (enabled: boolean) => void;
  onLocale: (value: GektaLocale) => void;
  onClearHistory: () => void;
  onClose: () => void;
}) {
  const ui = UI[locale];
  const panelRef = useDialogFocus(true, onClose);
  const [speechCapable, setSpeechCapable] = React.useState(false);

  // Voice controls appear only where the browser can actually deliver them.
  React.useEffect(() => {
    const recognition = createSpeechRecognition(locale);
    setSpeechCapable(recognition !== null || speechSynthesisAvailable());
    recognition?.abort?.();
  }, [locale]);

  return (
    <div className='fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4' onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby='gekta-settings-title'
        data-gekta-settings='true'
        className='max-h-[92svh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-lg sm:rounded-3xl sm:pb-5'
      >
        <div className='flex items-start justify-between gap-4'>
          <h2 id='gekta-settings-title' className='text-lg font-semibold text-slate-950'>{ui.title}</h2>
          <button type='button' onClick={onClose} aria-label={ui.close} className='flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
            <X className='h-5 w-5' aria-hidden='true' />
          </button>
        </div>

        <section className='mt-5'>
          <h3 className='text-sm font-semibold text-slate-900'>{ui.interface}</h3>
          <div className='mt-2 flex flex-wrap gap-2'>
            {(['ru', 'en', 'zh'] as const).map((value) => (
              <button
                key={value}
                type='button'
                onClick={() => onLocale(value)}
                aria-current={locale === value}
                className={`min-h-11 rounded-xl border px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${locale === value ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                {ui.languages[value]}
              </button>
            ))}
          </div>
          <p className='mt-2 text-xs leading-5 text-slate-500'>{ui.interfaceHint} <span className='text-slate-400'>{GEKTA_PATHS[locale]}</span></p>
        </section>

        <section className='mt-6'>
          <h3 className='text-sm font-semibold text-slate-900'>{ui.answers}</h3>
          <label className='mt-2 block text-xs font-medium text-slate-600' htmlFor='gekta-answer-locale'>{ui.answerLanguage}</label>
          <select
            id='gekta-answer-locale'
            value={answerLocale}
            onChange={(event) => onAnswerLocale(event.target.value as GektaAnswerLocale)}
            className='mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500'
          >
            <option value='auto'>{ui.answerAuto}</option>
            <option value='ru'>{ui.languages.ru}</option>
            <option value='en'>{ui.languages.en}</option>
            <option value='zh'>{ui.languages.zh}</option>
          </select>
          <p className='mt-2 text-xs leading-5 text-slate-500'>{ui.answerHint}</p>
        </section>

        <section className='mt-6'>
          <h3 className='text-sm font-semibold text-slate-900'>{ui.voice}</h3>
          {speechCapable ? (
            <>
              <Toggle id='gekta-voice-input' label={ui.voiceInput} hint={ui.voiceInputHint} checked={voiceInputEnabled} onChange={onVoiceInput} />
              <Toggle id='gekta-voice-output' label={ui.voiceOutput} hint={ui.voiceOutputHint} checked={voiceOutputEnabled} onChange={onVoiceOutput} />
            </>
          ) : (
            <p className='mt-2 text-xs leading-5 text-slate-500'>{ui.voiceUnsupported}</p>
          )}
        </section>

        {extraSections}

        <section className='mt-6'>
          <h3 className='text-sm font-semibold text-slate-900'>{ui.history}</h3>
          <p className='mt-2 text-xs leading-5 text-slate-500'>{ui.historyHint}</p>
          {hasHistory ? (
            <button type='button' onClick={onClearHistory} className='mt-3 min-h-11 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-800 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700'>
              {ui.clear}
            </button>
          ) : null}
        </section>

        {/* Карточка сама решает, показываться ли: у анонимного посетителя
            аккаунта нет, и поле телефона ему не нужно. */}
        <GektaPhoneCard />
      </div>
    </div>
  );
}
