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
    document.addEventListener('click', handleHeaderNavigation, true);
    document.addEventListener('keydown', handleHeaderKeyboard, true);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          normalizeNodeText(node);
          if (node instanceof Element) {
            normalizeTree(node);
            polishDrawer(node);
          }
        });
      }
      polishDrawer(document.body);
      stabilizeHeaderLinks();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.removeEventListener('click', handleHeaderNavigation, true);
      document.removeEventListener('keydown', handleHeaderKeyboard, true);
    };
  }, []);

  return null;
}
