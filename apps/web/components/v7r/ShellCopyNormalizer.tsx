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

export function ShellCopyNormalizer() {
  React.useEffect(() => {
    normalizeTree(document.body);
    polishDrawer(document.body);
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
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
