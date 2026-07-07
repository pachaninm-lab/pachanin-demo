'use client';

import { useEffect } from 'react';

const PATCH: Record<string, string> = {
  'Пилот': 'Подключение',
  'Пилотный проект': 'Подключение организации',
  'Демонстрация': 'Контур сделки',
  'Demo': 'Deal circuit',
  'Pilot': 'Connection',
  'Pilot project': 'Organisation connection',
  '演示': '交易闭环',
  '试点': '接入',
  '试点项目': '组织接入',
};

function norm(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function runPatch() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const next = PATCH[norm(node.nodeValue || '')];
    if (next) node.nodeValue = next;
    node = walker.nextNode() as Text | null;
  }
}

export function PlatformV7ProductionCopyPatch() {
  useEffect(() => {
    runPatch();
    const schedule = () => window.requestAnimationFrame(runPatch);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(runPatch, 1500);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
