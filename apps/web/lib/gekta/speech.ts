import type { GektaLocale } from './content';

/**
 * Browser-native speech only. No paid speech API is contacted, no audio is
 * uploaded and no recording is retained by the product.
 */

export type SpeechInputState = 'unsupported' | 'idle' | 'permission' | 'listening' | 'processing' | 'ready' | 'error';

export const GEKTA_SPEECH_LOCALES: Record<GektaLocale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  zh: 'zh-CN',
};

type SpeechRecognitionAlternativeLike = { transcript?: unknown };
type SpeechRecognitionResultLike = { 0?: SpeechRecognitionAlternativeLike; isFinal?: boolean; length?: number };

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<SpeechRecognitionResultLike>; resultIndex: number }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function createSpeechRecognition(locale: GektaLocale): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const scope = window as SpeechWindow;
  const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.lang = GEKTA_SPEECH_LOCALES[locale];
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  return recognition;
}

export function speechSynthesisAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

/** Concatenate the recognised alternatives into one editable string. */
export function transcriptFrom(results: ArrayLike<SpeechRecognitionResultLike>): string {
  let text = '';
  for (let index = 0; index < results.length; index += 1) {
    const alternative = results[index]?.[0];
    if (alternative && typeof alternative.transcript === 'string') text += alternative.transcript;
  }
  return text.replace(/\s+/gu, ' ').trim();
}

/**
 * Pick the closest installed voice. Returning undefined is fine: the platform
 * then reads with its default voice for the requested language.
 */
export function pickVoice(voices: readonly SpeechSynthesisVoice[], locale: GektaLocale): SpeechSynthesisVoice | undefined {
  const target = GEKTA_SPEECH_LOCALES[locale].toLowerCase();
  const language = target.split('-')[0];
  return voices.find((voice) => voice.lang?.toLowerCase() === target)
    ?? voices.find((voice) => voice.lang?.toLowerCase().startsWith(language));
}
