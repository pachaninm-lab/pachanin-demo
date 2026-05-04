'use client';

import * as React from 'react';

const TEXT_REPLACEMENTS: Array<[string, string]> = [
  ['Controlled pilot', 'Пилотный режим'],
  ['Sandbox + callbacks', 'Тестовая среда · ответы банка'],
  ['Sandbox + evidence', 'Тестовая среда · доказательства'],
  ['Sandbox + rules', 'Тестовая среда · правила сделки'],
  ['Simulation-grade контур исполнения', 'Тестовый контур исполнения'],
  ['Simulation-grade', 'Тестовый сценарий сделки'],
  ['simulation-only', 'тестовый контур'],
  ['sandbox/readiness не должен выглядеть как юридически полностью закрытый live-допуск', 'Предпилотная готовность не является подтверждённым боевым допуском'],
  ['Выпустить полностью?', 'Зафиксировать решение: полный выпуск?'],
  ['Выпустить полностью', 'Зафиксировать решение: полный выпуск'],
  ['Будет выпущено', 'Будет зафиксировано решение о выпуске'],
  ['Выпуск 512 тыс. ₽ инициирован', 'Решение о полном выпуске 512 тыс. ₽ зафиксировано'],
  ['Control Tower', 'Центр управления'],
  ['callbacks', 'ответы банка'],
  ['callback', 'ответ банка'],
  ['evidence-first', 'доказательный контур'],
  ['Evidence', 'Доказательства'],
  ['Audit', 'Журнал'],
  ['Timeline', 'Ход сделки'],
  ['ACTION TYPE', 'ДЕЙСТВИЕ'],
  ['OWNER', 'ОТВЕТСТВЕННЫЙ'],
  ['Action type', 'Действие'],
  ['Owner действия', 'Ответственный'],
  ['guard-правила', 'проверка условий'],
  ['guardBlocked', 'действие остановлено'],
  ['stateTransition', 'статус изменён'],
  ['runtime-контур', 'контур исполнения'],
  ['Action handoff', 'передача следующего действия'],
  ['requestReserve', 'запросить резерв'],
  ['confirmReserve', 'подтвердить резерв'],
  ['assignDriver', 'назначить водителя'],
  ['publishLot', 'опубликовать лот'],
  ['release', 'выпуск денег'],
  ['review', 'ручная проверка'],
  ['REVIEW', 'ПРОВЕРКА'],
  ['Dispute open', 'Открыт спор'],
  ['blocker', 'причина остановки'],
  ['Blocker', 'Причина остановки'],
];

const SIDE_DRAWER_HIDDEN_LINK_TEXT = new Set(['Инвестор', 'Демо']);
const SURFACE_SELECTOR = 'section, article, div, a, button, label, li, span, small';
const TEXT_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, span, strong, small, label, div';

type DarkSurfaceMode = 'surface' | 'action' | 'hero' | 'chip';
type ChipTone = 'neutral' | 'success' | 'warning' | 'danger';

function normalizeNodeText(node: Node) {
  if (node.nodeType === Node.TEXT_NODE && node.textContent) {
    let next = node.textContent;
    for (const [from, to] of TEXT_REPLACEMENTS) {
      next = next.split(from).join(to);
    }
    if (next !== node.textContent) node.textContent = next;
  }
}

function normalizeTree(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Node[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(normalizeNodeText);
}

function parseRgb(value: string) {
  const match = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

function isDarkRuntimeMode() {
  const theme = document.documentElement.getAttribute('data-theme');
  return theme !== 'light' && theme !== 'high-contrast';
}

function isNearWhite(value: string) {
  const rgb = parseRgb(value);
  if (!rgb || rgb.a < 0.55) return false;
  return rgb.r >= 232 && rgb.g >= 232 && rgb.b >= 232;
}

function isPaleText(value: string) {
  const rgb = parseRgb(value);
  if (!rgb || rgb.a < 0.55) return false;
  return rgb.r >= 176 && rgb.g >= 176 && rgb.b >= 176;
}

function hasVisibleBox(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return rect.width >= 24 && rect.height >= 14;
}

function isLargeHeroCandidate(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  if (rect.width < 260 || rect.height < 220) return false;
  if (!el.querySelector('h1, h2')) return false;
  if (el.closest('[aria-label*="карта" i], [data-map], .map, .ymaps')) return false;
  return true;
}

function isLightGradient(value: string) {
  if (!value || value === 'none') return false;
  const normalized = value.toLowerCase();
  if (!normalized.includes('gradient') && !normalized.includes('rgb') && !normalized.includes('#fff') && !normalized.includes('white')) return false;
  return /rgb[a]?\(\s*(23[2-9]|24\d|25[0-5])\s*,\s*(23[2-9]|24\d|25[0-5])\s*,\s*(23[2-9]|24\d|25[0-5])/.test(normalized) || normalized.includes('#fff') || normalized.includes('white');
}

function hasPaleHeroHeading(el: HTMLElement) {
  const heading = el.querySelector('h1, h2') as HTMLElement | null;
  if (!heading) return false;
  return isPaleText(window.getComputedStyle(heading).color);
}

function numericStyle(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCompactPillCandidate(el: HTMLElement, computed: CSSStyleDeclaration) {
  const rect = el.getBoundingClientRect();
  if (rect.width < 34 || rect.height < 16 || rect.height > 64) return false;
  if (el.children.length > 2) return false;
  const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  if (!text || text.length > 96) return false;
  const radius = numericStyle(computed.borderTopLeftRadius);
  const tag = el.tagName;
  return radius >= 8 || tag === 'BUTTON' || tag === 'A' || tag === 'SPAN' || tag === 'SMALL' || el.getAttribute('role') === 'button';
}

function inferChipTone(el: HTMLElement): ChipTone {
  const text = el.textContent?.toLowerCase() ?? '';
  if (/спор|ошиб|стоп|останов|не подтверж|не создан|требует|удержан|расхожд|просроч/.test(text)) return 'danger';
  if (/жд[её]т|ожида|draft|симуляц|провер|частич|rfq|сценар/.test(text)) return 'warning';
  if (/актив|готов|подтверж|закрыт|подписан|доступен/.test(text)) return 'success';
  return 'neutral';
}

function shouldSkipSurface(el: HTMLElement) {
  const tag = el.tagName;
  if (tag === 'HTML' || tag === 'BODY' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || tag === 'PATH' || tag === 'IMG') return true;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.closest('.pc-shell-header, .pc-fixed-header')) return true;
  if (el.dataset.p7DarkFixed === 'surface' || el.dataset.p7DarkFixed === 'action' || el.dataset.p7DarkFixed === 'hero' || el.dataset.p7DarkFixed === 'chip') return true;
  return false;
}

function markSurface(el: HTMLElement, mode: DarkSurfaceMode) {
  el.dataset.p7DarkFixed = mode;
  if (mode === 'hero') {
    el.style.background = 'linear-gradient(145deg, var(--p7-color-surface), var(--p7-color-background-elevated))';
    el.style.backgroundColor = 'var(--p7-color-surface)';
    el.style.backgroundImage = 'linear-gradient(145deg, var(--p7-color-surface), var(--p7-color-background-elevated))';
  } else if (mode === 'chip') {
    const tone = inferChipTone(el);
    const bg = tone === 'danger' ? 'var(--p7-color-danger-soft)' : tone === 'warning' ? 'var(--p7-color-warning-soft)' : tone === 'success' ? 'var(--p7-color-success-soft)' : 'var(--p7-color-surface-muted)';
    const fg = tone === 'danger' ? 'var(--p7-color-danger)' : tone === 'warning' ? 'var(--p7-color-warning)' : tone === 'success' ? 'var(--p7-color-success)' : 'var(--p7-color-text-primary)';
    el.style.background = bg;
    el.style.backgroundColor = bg;
    el.style.backgroundImage = 'none';
    el.style.color = fg;
    el.style.borderColor = tone === 'neutral' ? 'var(--p7-color-border)' : `color-mix(in srgb, ${fg} 38%, transparent)`;
  } else {
    el.style.background = mode === 'action' ? 'var(--p7-color-surface-muted)' : 'var(--p7-color-surface)';
    el.style.backgroundColor = mode === 'action' ? 'var(--p7-color-surface-muted)' : 'var(--p7-color-surface)';
  }
  if (mode !== 'chip') {
    el.style.borderColor = 'var(--p7-color-border)';
    el.style.color = 'var(--p7-color-text-primary)';
  }
  el.style.boxShadow = mode === 'chip' ? 'none' : 'var(--pc-shadow-sm)';
  if (mode === 'action' || mode === 'chip') {
    el.style.opacity = '1';
  }
}

function stabilizeTextInside(surface: HTMLElement, mode: DarkSurfaceMode = 'surface') {
  const textNodes = Array.from(surface.querySelectorAll(TEXT_SELECTOR)) as HTMLElement[];
  for (const node of textNodes) {
    if (node.closest('button, a') && node.closest('button, a') !== surface) continue;
    const computed = window.getComputedStyle(node);
    const isHeading = /^H[1-6]$/.test(node.tagName) || node.tagName === 'STRONG';
    if (mode === 'hero' || isHeading || isPaleText(computed.color)) {
      node.style.color = isHeading ? 'var(--p7-color-text-primary)' : 'var(--p7-color-text-secondary)';
      node.style.opacity = '1';
    }
  }
}

function stabilizeDarkSurfaces(root: ParentNode = document) {
  if (!isDarkRuntimeMode()) return;
  const scopes = Array.from(document.querySelectorAll('.pc-main, main')) as HTMLElement[];
  const scopeSet = new Set<HTMLElement>(scopes.length ? scopes : [document.body]);
  const candidates: HTMLElement[] = [];

  if (root instanceof HTMLElement && root.matches(SURFACE_SELECTOR)) candidates.push(root);
  if ('querySelectorAll' in root) candidates.push(...(Array.from(root.querySelectorAll(SURFACE_SELECTOR)) as HTMLElement[]));

  for (const el of candidates) {
    if (shouldSkipSurface(el) || !hasVisibleBox(el)) continue;
    const inScope = Array.from(scopeSet).some((scope) => scope === el || scope.contains(el));
    if (!inScope) continue;

    const computed = window.getComputedStyle(el);
    const hasLightSurface = isNearWhite(computed.backgroundColor);
    const hasLightGradient = isLightGradient(computed.backgroundImage);
    const hasLightHeroGradient = isLargeHeroCandidate(el) && (hasLightGradient || hasPaleHeroHeading(el));
    const hasLightChip = isCompactPillCandidate(el, computed) && (hasLightSurface || hasLightGradient || isPaleText(computed.color));
    if (!hasLightSurface && !hasLightHeroGradient && !hasLightChip) continue;

    const mode: DarkSurfaceMode = hasLightHeroGradient ? 'hero' : hasLightChip ? 'chip' : el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button' ? 'action' : 'surface';
    markSurface(el, mode);
    stabilizeTextInside(el, mode);
  }
}

function polishDrawer(root: ParentNode = document) {
  const links = Array.from(root.querySelectorAll('a'));
  for (const link of links) {
    const text = link.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const href = link.getAttribute('href') ?? '';
    const isOutsideMain = !link.closest('.pc-main');
    const isDrawerServiceLink = SIDE_DRAWER_HIDDEN_LINK_TEXT.has(text) || href.startsWith('/platform-v7/investor') || href.startsWith('/platform-v7/demo');
    if (isOutsideMain && isDrawerServiceLink) {
      (link as HTMLElement).style.display = 'none';
      link.setAttribute('aria-hidden', 'true');
    }
  }
}

function setHeaderAction(el: HTMLElement | null, label: string, tabIndex = 0) {
  if (!el) return;
  el.setAttribute('role', el.getAttribute('role') || 'button');
  el.setAttribute('aria-label', label);
  el.setAttribute('tabindex', String(tabIndex));
  el.style.cursor = 'pointer';
}

function stabilizeHeaderLinks() {
  const brand = document.querySelector('.pc-header-brand') as HTMLElement | null;
  setHeaderAction(brand, 'Открыть главную страницу платформы');

  const roleButton = document.querySelector('.pc-mobile-role') as HTMLElement | null;
  if (roleButton) {
    roleButton.setAttribute('aria-label', 'Открыть выбор роли');
    roleButton.style.cursor = 'pointer';
  }
}

function isInteractiveElement(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('a,button,input,select,textarea,[role="button"]'));
}

function handleHeaderNavigation(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const brand = target.closest('.pc-header-brand');
  if (brand && !target.closest('button,a,select,input,textarea')) {
    window.location.assign('/platform-v7');
    return;
  }

  const roleButton = target.closest('.pc-mobile-role');
  if (roleButton) {
    window.location.assign('/platform-v7/roles');
  }
}

function handleHeaderKeyboard(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target;
  if (!(target instanceof Element)) return;

  const brand = target.closest('.pc-header-brand');
  if (brand && !isInteractiveElement(target)) {
    event.preventDefault();
    window.location.assign('/platform-v7');
    return;
  }

  const roleButton = target.closest('.pc-mobile-role');
  if (roleButton) {
    event.preventDefault();
    window.location.assign('/platform-v7/roles');
  }
}

export function ShellCopyNormalizer() {
  React.useEffect(() => {
    normalizeTree(document.body);
    polishDrawer(document.body);
    stabilizeHeaderLinks();
    stabilizeDarkSurfaces(document.body);
    requestAnimationFrame(() => stabilizeDarkSurfaces(document.body));
    document.addEventListener('click', handleHeaderNavigation, true);
    document.addEventListener('keydown', handleHeaderKeyboard, true);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          normalizeNodeText(node);
          if (node instanceof Element) {
            normalizeTree(node);
            polishDrawer(node);
            stabilizeDarkSurfaces(node);
          }
        });
      }
      polishDrawer(document.body);
      stabilizeHeaderLinks();
      stabilizeDarkSurfaces(document.body);
    });
    const themeObserver = new MutationObserver(() => {
      stabilizeDarkSurfaces(document.body);
      requestAnimationFrame(() => stabilizeDarkSurfaces(document.body));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      document.removeEventListener('click', handleHeaderNavigation, true);
      document.removeEventListener('keydown', handleHeaderKeyboard, true);
    };
  }, []);

  return null;
}
