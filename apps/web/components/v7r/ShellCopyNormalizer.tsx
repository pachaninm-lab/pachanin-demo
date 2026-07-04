'use client';

import * as React from 'react';

type DarkFixMode = 'surface' | 'action' | 'hero' | 'chip';
type ChipTone = 'neutral' | 'warning' | 'danger' | 'success';

// Нормализация терминов — да; маскировка отказа — нет. Ранее этот слой
// переписывал честное «API недоступен» в «Источники подключаются · показан
// рабочий сценарий» — посетитель не мог отличить живую систему от витрины
// (аудит: баннер создавал впечатление работающего API). Статус источника
// данных всегда говорит правду: недоступен → «демонстрационные данные».
const NORMALIZED_RUNTIME_COPY = new Map([
  ['Зафиксировать решение: полный выпуск', 'Зафиксировать решение: банковская проверка выплаты'],
  ['Предпилотная готовность', 'Готовность к предынтеграционному контуру'],
  ['Демо-готовность', 'Готовность контура'],
  ['демо-готовность', 'готовность контура'],
  ['пилотный сценарий', 'рабочий сценарий'],
  ['Пилотный сценарий', 'Рабочий сценарий'],
  ['по документу пилота', 'по документу сделки'],
  ['API-контур недоступен · показан локальный сценарий', 'Демонстрационные данные — сервер недоступен'],
  ['Демонстрационные данные — сервер недоступен', 'Демонстрационные данные — сервер недоступен'],
  ['FARMER · Кабинет продавца', 'Продавец · кабинет сделки'],
  ['FARMER', 'Продавец'],
]);

const CHIP_TONE_SURFACES: Record<Exclude<ChipTone, 'neutral'>, string> = {
  warning: 'var(--p7-color-warning-soft)',
  danger: 'var(--p7-color-danger-soft)',
  success: 'var(--p7-color-success-soft)',
};

function isLightColor(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, '');
  if (!normalized || normalized === 'transparent' || normalized === 'rgba(0,0,0,0)') return false;
  if (normalized.includes('#fff') || normalized.includes('#ffffff') || normalized.includes('white')) return true;

  const rgb = normalized.match(/rgba?\((\d+),(\d+),(\d+)(?:,[^)]+)?\)/);
  if (!rgb) return false;
  const [, red, green, blue] = rgb.map(Number);
  return red >= 238 && green >= 238 && blue >= 238;
}

function isLightGradient(value: string) {
  return value.toLowerCase().includes('gradient') && isLightColor(value);
}

function hasPaleHeroHeading(el: HTMLElement) {
  const heading = el.querySelector<HTMLElement>('h1,h2,[data-hero-heading]');
  if (!heading) return false;
  const style = window.getComputedStyle(heading);
  return isLightColor(style.color) || style.color === 'rgb(15, 20, 25)' || style.color === 'rgb(17, 24, 39)';
}

function isLargeHeroCandidate(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return rect.height >= 160 && rect.width >= 280 && Boolean(el.querySelector('h1,h2,[data-hero-heading]'));
}

function isCompactPillCandidate(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  const radius = Number.parseFloat(style.borderRadius || '0');
  return rect.height > 0 && rect.height <= 52 && rect.width <= 360 && radius >= 10;
}

function inferChipTone(el: HTMLElement): ChipTone {
  const text = (el.textContent || '').toLowerCase();
  if (/ошиб|риск|спор|заблок|blocked|danger/.test(text)) return 'danger';
  if (/ожида|провер|pending|warning|на проверку/.test(text)) return 'warning';
  if (/готов|подтверж|success|ready|ok/.test(text)) return 'success';
  return 'neutral';
}

function hasLightChip(el: HTMLElement) {
  const style = window.getComputedStyle(el);
  return isCompactPillCandidate(el) && (isLightColor(style.backgroundColor) || isLightGradient(style.backgroundImage));
}

function classifyDarkFix(el: HTMLElement): DarkFixMode | null {
  const style = window.getComputedStyle(el);
  const isLightSurface = isLightColor(style.backgroundColor) || isLightGradient(style.backgroundImage);
  if (!isLightSurface) return null;
  if (isLargeHeroCandidate(el) && (isLightGradient(style.backgroundImage) || hasPaleHeroHeading(el))) return 'hero';
  if (hasLightChip(el)) return 'chip';
  if (el.matches('button,a,[role="button"],input,select,textarea')) return 'action';
  if (el.matches('section,article,aside,form,div,li,td,th')) return 'surface';
  return null;
}

function normalizeRuntimeCopy(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  for (const node of nodes) {
    let nextValue = node.nodeValue || '';
    for (const [from, to] of NORMALIZED_RUNTIME_COPY) {
      nextValue = nextValue.replaceAll(from, to);
    }
    if (nextValue !== node.nodeValue) node.nodeValue = nextValue;
  }
}

export function stabilizeDarkSurfaces(root: ParentNode = document) {
  normalizeRuntimeCopy(root);

  const theme = document.documentElement.dataset.theme;
  if (theme === 'light' || theme === 'high-contrast') return;

  const candidates = root.querySelectorAll<HTMLElement>(
    '.pc-main section,.pc-main article,.pc-main aside,.pc-main form,.pc-main div,.pc-main li,.pc-main td,.pc-main th,.pc-main button,.pc-main a,.pc-main input,.pc-main select,.pc-main textarea',
  );

  for (const el of candidates) {
    if (el.dataset.p7DarkFixed) continue;
    const mode = classifyDarkFix(el);
    if (!mode) continue;
    el.dataset.p7DarkFixed = mode;
    if (mode === 'hero') el.dataset.p7DarkHero = 'true';
    if (el.dataset.p7DarkFixed === 'chip') {
      const tone = inferChipTone(el);
      if (tone !== 'neutral') el.style.setProperty('--p7-chip-tone-surface', CHIP_TONE_SURFACES[tone]);
    }
  }
}

export function ShellCopyNormalizer() {
  React.useEffect(() => {
    let frame = 0;

    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => stabilizeDarkSurfaces(document));
    }

    schedule();

    const themeObserver = new MutationObserver(schedule);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const contentObserver = new MutationObserver(schedule);
    contentObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

    return () => {
      window.cancelAnimationFrame(frame);
      themeObserver.disconnect();
      contentObserver.disconnect();
    };
  }, []);

  return null;
}
