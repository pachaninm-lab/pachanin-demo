'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

const TEXT_REPLACEMENTS: Array<[string, string]> = [
  ['Controlled pilot', 'Пилотный режим'],
  ['Sandbox + callbacks', 'Тестовая среда · входящие события'],
  ['Sandbox + evidence', 'Тестовая среда · доказательства'],
  ['Sandbox + rules', 'Тестовая среда · правила'],
  ['Control Tower', 'Центр управления'],
  ['callbacks', 'входящие события'],
  ['evidence-first', 'доказательства первичны'],
  ['release', 'выпуск денег'],
  ['review', 'ручная проверка'],
  ['blocker', 'препятствие'],
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
  const pathname = usePathname();
  const disabledForFieldShell = pathname === '/platform-v7/driver' || pathname.startsWith('/platform-v7/driver/');

  React.useEffect(() => {
    if (disabledForFieldShell) return;

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
  }, [disabledForFieldShell]);

  return null;
}
