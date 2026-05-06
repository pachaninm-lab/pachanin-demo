'use client';

import * as React from 'react';

const UI_TEXT_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['Control Tower', 'Центр управления'],
  ['Controlled pilot', 'Пилотный режим'],
  ['Sandbox + callbacks', 'Тестовый контур · ответы банка'],
  ['Sandbox + evidence', 'Тестовый контур · доказательства'],
  ['Sandbox + rules', 'Тестовый контур · правила сделки'],
  ['RFQ / закупки', 'Закупочные запросы'],
  ['Демо-цепочка', 'Проверочный сценарий'],
  ['Демо-сценарий', 'Проверочный сценарий'],
  ['Инвесторский режим', 'Инвесторский обзор'],
  ['Тестовый режим', 'Тестовый контур'],
  ['AI-помощник', 'Помощник сделки'],
  ['AI', 'помощник сделки'],
  ['callbacks', 'ответы банка'],
  ['callback', 'ответ банка'],
  ['release', 'выпуск денег'],
  ['hold', 'удержание денег'],
  ['owner', 'ответственный'],
  ['blocker', 'причина остановки'],
  ['marketplace', 'лоты и запросы'],
  ['domain-core', 'контур сделки'],
];

function normalizeTextNode(node: Node) {
  if (node.nodeType !== Node.TEXT_NODE || !node.textContent) return;

  let text = node.textContent;
  for (const [from, to] of UI_TEXT_REPLACEMENTS) {
    text = text.split(from).join(to);
  }

  if (text !== node.textContent) {
    node.textContent = text;
  }
}

function normalizeTextTree(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Node[] = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  nodes.forEach(normalizeTextNode);
}

function normalizeAttributes(root: ParentNode) {
  const elements = Array.from(root.querySelectorAll('[aria-label], [title]')) as HTMLElement[];

  for (const element of elements) {
    for (const attr of ['aria-label', 'title'] as const) {
      const value = element.getAttribute(attr);
      if (!value) continue;

      let next = value;
      for (const [from, to] of UI_TEXT_REPLACEMENTS) {
        next = next.split(from).join(to);
      }

      if (next !== value) {
        element.setAttribute(attr, next);
      }
    }
  }
}

function normalizeRoot(root: ParentNode) {
  normalizeTextTree(root);
  normalizeAttributes(root);
}

export function PlatformV7UiTextGuard() {
  React.useEffect(() => {
    normalizeRoot(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          normalizeTextNode(node);
          if (node instanceof Element) {
            normalizeRoot(node);
          }
        });
      }
      normalizeAttributes(document.body);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
