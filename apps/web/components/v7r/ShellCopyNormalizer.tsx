'use client';

import * as React from 'react';

const TEXT_REPLACEMENTS: Array<[string, string]> = [
  ['Controlled pilot', 'Пилотный режим'],
  ['Sandbox + callbacks', 'Тестовая среда · ответы банка'],
  ['Sandbox + evidence', 'Тестовая среда · доказательства'],
  ['Sandbox + rules', 'Тестовая среда · правила сделки'],
  ['Simulation-grade контур исполнения', 'Тестовый контур исполнения'],
  ['Simulation-grade', 'Тестовый сценарий сделки'],
  ['Control Tower', 'Центр управления'],
  ['callbacks', 'ответы банка'],
  ['evidence-first', 'доказательный контур'],
  ['guard-правила', 'проверка условий'],
  ['runtime-контур', 'контур исполнения'],
  ['Action handoff', 'передача следующего действия'],
  ['requestReserve', 'запросить резерв'],
  ['release', 'выпуск денег'],
  ['review', 'ручная проверка'],
  ['blocker', 'причина остановки'],
];

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

export function ShellCopyNormalizer() {
  React.useEffect(() => {
    normalizeTree(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          normalizeNodeText(node);
          if (node instanceof Element) normalizeTree(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
