'use client';

import * as React from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { GektaLocale } from '@/lib/gekta/content';
import { createSpeechRecognition, speechSynthesisAvailable } from '@/lib/gekta/speech';
import { GektaPhoneCard } from './GektaPhoneCard';
import { useDialogFocus } from './useDialogFocus';
import { GektaThemeOptions } from './GektaAppearance';
import styles from './GektaWorkspace.module.css';

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className='mt-2 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-1 py-2 focus-within:bg-slate-50'>
      <span className='min-w-0'>
        <span className='block text-sm font-medium text-slate-800'>{label}</span>
        <span className='mt-0.5 block text-xs leading-5 text-slate-500'>{hint}</span>
      </span>
      <input
        id={id}
        type='checkbox'
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className='sr-only'
      />
      <span className={styles.settingSwitch} aria-hidden='true' />
    </label>
  );
}

export type GektaAnswerLocale = 'auto' | GektaLocale;

const UI = {
  ru: {
    title: 'Настройки',
    close: 'Закрыть настройки',
    interface: 'Язык интерфейса',
    answerLanguage: 'Язык ответа',
    answerAuto: 'Как интерфейс',
    voice: 'Голос',
    voiceInput: 'Голосовой ввод',
    voiceInputHint: 'Браузер превращает речь в текст для поля ввода.',
    voiceOutput: 'Озвучивание ответов',
    voiceOutputHint: 'Показывает кнопку «Прослушать» под ответами.',
    voiceUnsupported: 'Браузер не поддерживает эту функцию — обычный чат работает без неё.',
    history: 'История и приватность',
    historyHint: 'История анонимного режима хранится только в этом браузере и не передаётся вместе с аналитикой.',
    clear: 'Удалить историю в этом браузере',
    languages: { ru: 'Русский', en: 'English', zh: '中文' },
  },
  en: {
    title: 'Settings',
    close: 'Close settings',
    interface: 'Interface language',
    answerLanguage: 'Answer language',
    answerAuto: 'Follow interface',
    voice: 'Voice',
    voiceInput: 'Voice input',
    voiceInputHint: 'The browser turns speech into text in the composer.',
    voiceOutput: 'Read answers aloud',
    voiceOutputHint: 'Shows a Listen button under answers.',
    voiceUnsupported: 'This browser does not support the feature — the normal chat works without it.',
    history: 'History and privacy',
    historyHint: 'Anonymous history is stored only in this browser and is never sent with analytics.',
    clear: 'Delete history in this browser',
    languages: { ru: 'Русский', en: 'English', zh: '中文' },
  },
  zh: {
    title: '设置',
    close: '关闭设置',
    interface: '界面语言',
    answerLanguage: '回答语言',
    answerAuto: '跟随界面',
    voice: '语音',
    voiceInput: '语音输入',
    voiceInputHint: '浏览器将语音转换为输入框中的文字。',
    voiceOutput: '朗读回答',
    voiceOutputHint: '在回答下方显示“朗读”按钮。',
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
export function GektaSettingsDialog({ locale, answerLocale, hasHistory, voiceInputEnabled, voiceOutputEnabled, extraSections, returnFocus, onAnswerLocale, onVoiceInput, onVoiceOutput, onLocale, onClearHistory, onClose }: {
  locale: GektaLocale;
  answerLocale: GektaAnswerLocale;
  hasHistory: boolean;
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  extraSections?: React.ReactNode;
  returnFocus?: HTMLElement | null;
  onAnswerLocale: (value: GektaAnswerLocale) => void;
  onVoiceInput: (enabled: boolean) => void;
  onVoiceOutput: (enabled: boolean) => void;
  onLocale: (value: GektaLocale) => void;
  onClearHistory: () => void;
  onClose: () => void;
}) {
  const ui = UI[locale];
  const panelRef = useDialogFocus(true, onClose, returnFocus);
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

        <GektaThemeOptions locale={locale} />

        <section className='mt-5 border-t border-slate-200 pt-4'>
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
        </section>

        <section className='mt-4'>
          <label className='block text-sm font-semibold text-slate-900' htmlFor='gekta-answer-locale'>{ui.answerLanguage}</label>
          <div className='relative mt-2'>
            <select
              id='gekta-answer-locale'
              value={answerLocale}
              onChange={(event) => onAnswerLocale(event.target.value as GektaAnswerLocale)}
              className={styles.selectControl}
            >
              <option value='auto'>{ui.answerAuto}</option>
              <option value='ru'>{ui.languages.ru}</option>
              <option value='en'>{ui.languages.en}</option>
              <option value='zh'>{ui.languages.zh}</option>
            </select>
            <ChevronDown className='pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500' aria-hidden='true' />
          </div>
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
