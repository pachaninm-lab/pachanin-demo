'use client';

import * as React from 'react';
import { PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS } from '@/lib/platform-v7/external-copy-guardrails';

const SKIP_PARENT_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE']);

function normalizeTextNode(node: Node) {
  if (node.nodeType !== Node.TEXT_NODE || !node.textContent) return;
  const parent = node.parentElement;
  if (parent && SKIP_PARENT_TAGS.has(parent.tagName)) return;

  let nextText = node.textContent;
  for (const [from, to] of Object.entries(PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS)) {
    nextText = nextText.split(from).join(to);
  }

  if (nextText !== node.textContent) {
    node.textContent = nextText;
  }
}

function normalizeTree(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Node[] = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  nodes.forEach(normalizeTextNode);
}

export function ExternalCopyGuard() {
  React.useEffect(() => {
    normalizeTree(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          normalizeTextNode(node);
          if (node instanceof Element) {
            normalizeTree(node);
          }
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
