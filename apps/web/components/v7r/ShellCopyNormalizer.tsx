'use client';

import { useEffect } from 'react';

type DarkFixMode = 'surface' | 'action' | 'hero' | 'chip';

const RISKY_COPY_NORMALIZATIONS: ReadonlyArray<readonly [string, string]> = [
  ['Зафиксировать решение: выпустить деньги', 'Зафиксировать решение: полный выпуск'],
  ['Пилотная готовность', 'Предпилотная готовность'],
];

const LIGHT_SURFACE_LUMINANCE = 0.82;
const CHIP_MAX_WIDTH = 220;
const CHIP_MAX_HEIGHT = 44;
const HERO_MIN_WIDTH = 480;
const HERO_MIN_HEIGHT = 120;

function parseRgb(value: string): [number, number, number] | null {
  const match = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);

  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => channel / 255);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isLightColor(value: string): boolean {
  const rgb = parseRgb(value);

  return rgb !== null && relativeLuminance(rgb) >= LIGHT_SURFACE_LUMINANCE;
}

function isLightGradient(backgroundImage: string): boolean {
  if (!backgroundImage.includes('gradient')) {
    return false;
  }

  const stops = backgroundImage.match(/rgba?\([^)]+\)/g) ?? [];

  return stops.length > 0 && stops.every((stop) => isLightColor(stop));
}

function hasPaleHeroHeading(el: HTMLElement): boolean {
  const heading = el.querySelector<HTMLElement>('h1, h2, h3');

  if (!heading) {
    return false;
  }

  return isLightColor(window.getComputedStyle(heading).color);
}

function isLargeHeroCandidate(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();

  return rect.width >= HERO_MIN_WIDTH && rect.height >= HERO_MIN_HEIGHT;
}

function isCompactPillCandidate(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) {
    return false;
  }

  return rect.width <= CHIP_MAX_WIDTH && rect.height <= CHIP_MAX_HEIGHT;
}

function hasLightChip(style: CSSStyleDeclaration): boolean {
  return isLightColor(style.backgroundColor) && style.borderRadius !== '0px';
}

function inferChipTone(el: HTMLElement): string {
  const text = (el.textContent ?? '').toLowerCase();

  if (/(стоп|блок|спор|просроч|откло)/.test(text)) {
    return 'var(--p7-color-danger-soft)';
  }

  if (/(жд[её]т|ожида|внимани|риск)/.test(text)) {
    return 'var(--p7-color-warning-soft)';
  }

  return 'var(--p7-color-surface-muted)';
}

function classifyDarkFixMode(el: HTMLElement, style: CSSStyleDeclaration): DarkFixMode | null {
  if (isLargeHeroCandidate(el) && (isLightGradient(style.backgroundImage) || (isLightColor(style.backgroundColor) && hasPaleHeroHeading(el)))) {
    return 'hero';
  }

  if (isCompactPillCandidate(el) && hasLightChip(style)) {
    return 'chip';
  }

  if (!isLightColor(style.backgroundColor)) {
    return null;
  }

  return el.matches('a, button, [role="button"]') ? 'action' : 'surface';
}

function applyDarkFix(el: HTMLElement, mode: DarkFixMode) {
  el.dataset.p7DarkFixed = mode;

  if (mode === 'hero') {
    el.style.backgroundImage = 'none';
    el.style.backgroundColor = 'var(--p7-color-surface)';
    el.style.color = 'var(--p7-color-text-primary)';
    return;
  }

  if (el.dataset.p7DarkFixed === 'chip') {
    el.style.backgroundColor = inferChipTone(el);
    el.style.color = 'var(--p7-color-text-primary)';
  }
}

function stabilizeDarkSurfaces(root: HTMLElement) {
  const theme = document.documentElement.dataset.theme;

  if (theme === 'light' || theme === 'high-contrast') {
    return;
  }

  for (const el of Array.from(root.querySelectorAll<HTMLElement>('.pc-main *'))) {
    if (el.dataset.p7DarkFixed) {
      continue;
    }

    const style = window.getComputedStyle(el);
    const mode = classifyDarkFixMode(el, style);

    if (mode) {
      applyDarkFix(el, mode);
    }
  }
}

function normalizeRiskyCopy(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let text = node.textContent ?? '';

    for (const [risky, safe] of RISKY_COPY_NORMALIZATIONS) {
      if (text.includes(risky)) {
        text = text.split(risky).join(safe);
      }
    }

    if (text !== node.textContent) {
      node.textContent = text;
    }
  }
}

export function ShellCopyNormalizer() {
  useEffect(() => {
    let frame = 0;

    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        normalizeRiskyCopy(document.body);
        stabilizeDarkSurfaces(document.body);
      });
    };

    run();

    const themeObserver = new MutationObserver(() => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-p7-dark-fixed]'))) {
        delete el.dataset.p7DarkFixed;
      }

      run();
    });

    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const contentObserver = new MutationObserver(run);

    contentObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      contentObserver.disconnect();
    };
  }, []);

  return null;
}
