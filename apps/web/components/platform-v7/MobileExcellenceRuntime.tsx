'use client';

import * as React from 'react';

const TEXT_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/DealDraft/g, 'черновик сделки'],
  [/Deal 360/g, 'карточка сделки'],
  [/Reference/g, 'Источник'],
  [/reference/g, 'источник'],
  [/Офферы/g, 'Предложения'],
  [/офферы/g, 'предложения'],
  [/Оффер/g, 'Предложение'],
  [/оффер/g, 'предложение'],
  [/Владелец/g, 'Ответственный'],
  [/владелец/g, 'ответственный'],
  [/Связка/g, 'Связь'],
  [/связка/g, 'связь'],
  [/Антиобход/g, 'контакт закрыт'],
  [/без критического стопа/g, 'без критической остановки'],
  [/Без критического стопа/g, 'Без критической остановки'],
  [/\bСтоп\b/g, 'остановлено'],
  [/\bстоп\b/g, 'остановлено'],
  [/Нужна проверка/g, 'на проверке'],
  [/нужна проверка/g, 'на проверке'],
  [/Ручные/g, 'Ручной источник'],
  [/ручные/g, 'ручной источник'],
];

const SKIP_TEXT_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);
const SECONDARY_HEADER_COPY = /тема|theme|поиск|search|помощь|help|справка/i;
const PRIMARY_HEADER_COPY = /уведом|notification|поддержка|support/i;

function shortFgisId(raw: string) {
  const normalized = raw.replace(/-/g, '').toUpperCase();
  return normalized.slice(-6) || normalized;
}

function normalizeText(value: string, parent?: HTMLElement | null) {
  let next = value;

  next = next.replace(/\bFGIS-PARTY-([A-Z0-9-]{4,})\b/g, (full, id: string) => {
    if (parent) {
      parent.dataset.fullFgisId = full;
      if (!parent.getAttribute('title')) parent.setAttribute('title', `Полный ID: ${full}`);
    }
    return `ФГИС:${shortFgisId(id)}`;
  });

  for (const [pattern, replacement] of TEXT_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }

  return next;
}

function shouldSkipTextNode(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;
  return Boolean(parent.closest(Array.from(SKIP_TEXT_TAGS).join(',')));
}

function normalizeTextNode(node: Node) {
  if (node.nodeType !== Node.TEXT_NODE || !node.textContent || shouldSkipTextNode(node)) return;
  const parent = node.parentElement;
  const next = normalizeText(node.textContent, parent);
  if (next !== node.textContent) node.textContent = next;
}

function normalizeAttributes(root: ParentNode) {
  const elements = Array.from(root.querySelectorAll('[aria-label], [title], [placeholder]')) as HTMLElement[];
  for (const element of elements) {
    for (const attr of ['aria-label', 'title', 'placeholder'] as const) {
      const value = element.getAttribute(attr);
      if (!value) continue;
      const next = normalizeText(value, element);
      if (next !== value) element.setAttribute(attr, next);
    }
  }
}

function normalizeTree(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Node[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(normalizeTextNode);
  normalizeAttributes(root);
}

function readableHeaderName(element: HTMLElement) {
  return [
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.textContent,
  ].filter(Boolean).join(' ');
}

function compactMobileHeaderControls() {
  const actions = document.querySelector('.pc-v4-actions') as HTMLElement | null;
  if (!actions) return;

  const controls = Array.from(actions.querySelectorAll<HTMLElement>('.pc-v4-iconbtn'));
  for (const control of controls) {
    const name = readableHeaderName(control);
    if (!control.dataset.supportHeaderIcon && SECONDARY_HEADER_COPY.test(name) && !PRIMARY_HEADER_COPY.test(name)) {
      control.dataset.mobileSecondaryControl = 'true';
      control.setAttribute('aria-hidden', 'true');
      control.setAttribute('tabindex', '-1');
    }
  }

  const primaryControls = controls.filter((control) => !control.dataset.mobileSecondaryControl);
  if (primaryControls.length <= 2) return;

  for (const control of primaryControls) {
    if (primaryControls.filter((item) => !item.dataset.mobileSecondaryControl).length <= 2) break;
    const name = readableHeaderName(control);
    if (PRIMARY_HEADER_COPY.test(name) || control.dataset.supportHeaderIcon) continue;
    control.dataset.mobileSecondaryControl = 'true';
    control.setAttribute('aria-hidden', 'true');
    control.setAttribute('tabindex', '-1');
  }
}

function ensureSupportInBurger() {
  const nav = document.querySelector('.pc-v4-nav') as HTMLElement | null;
  if (!nav || nav.querySelector('[data-mobile-support-link="true"]')) return;

  const link = document.createElement('a');
  link.href = '/platform-v7/support';
  link.className = 'pc-v4-nav-item';
  link.dataset.mobileSupportLink = 'true';
  link.dataset.supportContext = 'true';
  link.innerHTML = [
    '<span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:12px;border:1px solid var(--pc-border);color:var(--pc-text-primary);font-weight:900;">?</span>',
    '<span style="min-width:0;display:block;">',
    '<span class="pc-v4-nav-label">Поддержка</span>',
    '<span class="pc-v4-nav-note">обращение по сделке или блокеру</span>',
    '</span>',
  ].join('');
  nav.appendChild(link);
}

function markRuntimeReady() {
  document.documentElement.dataset.platformV7MobileExcellence = 'ready';
  document.querySelector('.pc-v4-header')?.setAttribute('data-mobile-shell', 'true');
}

function run(root: ParentNode = document.body) {
  normalizeTree(root);
  compactMobileHeaderControls();
  ensureSupportInBurger();
  markRuntimeReady();
}

export function MobileExcellenceRuntime() {
  React.useEffect(() => {
    run(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          normalizeTextNode(node);
          if (node instanceof Element) run(node);
        });
      }
      compactMobileHeaderControls();
      ensureSupportInBurger();
      markRuntimeReady();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
