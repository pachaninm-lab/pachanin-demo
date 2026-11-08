'use client';

import * as React from 'react';
import { Square, Volume2 } from 'lucide-react';
import type { GektaLocale } from '@/lib/gekta/content';
import { GEKTA_SPEECH_LOCALES, pickVoice, speechSynthesisAvailable } from '@/lib/gekta/speech';

const UI = {
  ru: { play: 'Прослушать', stop: 'Остановить чтение' },
  en: { play: 'Listen', stop: 'Stop playback' },
  zh: { play: '朗读', stop: '停止朗读' },
} as const;

/**
 * Reading an answer aloud with the browser's own speech synthesis. No paid
 * speech service is used, and a browser without synthesis simply does not show
 * the control — the rest of the conversation is unaffected.
 */
export function GektaSpeakButton({ locale, text, onEvent }: { locale: GektaLocale; text: string; onEvent?: (event: 'started' | 'stopped') => void }) {
  const ui = UI[locale];
  const [available, setAvailable] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  React.useEffect(() => {
    setAvailable(speechSynthesisAvailable());
    return () => {
      if (speechSynthesisAvailable() && utteranceRef.current) window.speechSynthesis.cancel();
    };
  }, []);

  const stop = React.useCallback(() => {
    if (!speechSynthesisAvailable()) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
    onEvent?.('stopped');
  }, [onEvent]);

  const play = React.useCallback(() => {
    if (!speechSynthesisAvailable() || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text.slice(0, 5_000));
    utterance.lang = GEKTA_SPEECH_LOCALES[locale];
    const voice = pickVoice(window.speechSynthesis.getVoices(), locale);
    if (voice) utterance.voice = voice;
    utterance.onend = () => { utteranceRef.current = null; setSpeaking(false); };
    utterance.onerror = () => { utteranceRef.current = null; setSpeaking(false); };
    utteranceRef.current = utterance;
    setSpeaking(true);
    onEvent?.('started');
    window.speechSynthesis.speak(utterance);
  }, [locale, onEvent, text]);

  if (!available) return null;

  return (
    <button
      type='button'
      onClick={speaking ? stop : play}
      className='inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
      aria-label={speaking ? ui.stop : ui.play}
      data-gekta-speak='true'
      aria-pressed={speaking}
    >
      {speaking ? <Square className='h-3 w-3 fill-current' aria-hidden='true' /> : <Volume2 className='h-3.5 w-3.5' aria-hidden='true' />}
      {speaking ? ui.stop : ui.play}
    </button>
  );
}
