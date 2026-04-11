'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const ROUTES: Record<string, string[]> = {
  '/platform-v4': ['/platform-v4/deal', '/platform-v4/buyer', '/platform-v4/bank', '/platform-v4/control'],
  '/platform-v4/seller': ['/platform-v4/seller/new-lot', '/platform-v4/deal', '/platform-v4/bank', '/platform-v4/documents'],
  '/platform-v4/buyer': ['/platform-v4/funding', '/platform-v4/bank', '/platform-v4/documents', '/platform-v4/deal'],
  '/platform-v4/bank': ['/platform-v4/bank', '/platform-v4/bank', '/platform-v4/control', '/platform-v4/deal'],
};

const FULL_REPLACE_ROUTES = new Set([
  '/platform-v4',
  '/platform-v4/deal',
  '/platform-v4/buyer',
  '/platform-v4/seller',
  '/platform-v4/driver',
  '/platform-v4/bank',
  '/platform-v4/roles',
  '/platform-v4/documents',
  '/platform-v4/control',
]);

const MANUAL_SCREENS: Record<string, { eyebrow: string; title: string; body: string; actions: Array<{ href: string; label: string; primary?: boolean }>; tiles: Array<{ href: string; kpi: string; label: string; hint: string; chip: string; tone: string }> }> = {
  '/platform-v4/roles': {
    eyebrow: 'Role-first UX',
    title: 'Каждая роль получает свой первый рабочий сценарий',
    body: 'Один универсальный кабинет для всех ломает продуктовую логику. Здесь вход строится от роли и полномочий.',
    actions: [
      { href: '/platform-v4/seller', label: 'Продавец', primary: true },
      { href: '/platform-v4/buyer', label: 'Покупатель' },
      { href: '/platform-v4/driver', label: 'Водитель' },
    ],
    tiles: [
      { href: '/platform-v4/seller', kpi: 'Seller', label: 'Лоты, сделки, деньги, рейсы', hint: 'коммерция + money rail', chip: 'role', tone: 'success' },
      { href: '/platform-v4/buyer', kpi: 'Buyer', label: 'Приёмка, качество, документы, выпуск', hint: 'исполнимая закупка', chip: 'role', tone: 'info' },
      { href: '/platform-v4/driver', kpi: 'Driver', label: 'Один рейс, один шаг, offline queue', hint: 'ultra-simple mobile', chip: 'role', tone: 'warning' },
      { href: '/platform-v4/bank', kpi: 'Bank', label: 'Readiness, callbacks, hold, mismatch', hint: 'без маркетинга', chip: 'role', tone: 'danger' },
    ],
  },
  '/platform-v4/documents': {
    eyebrow: 'Documents gate',
    title: 'Документы — это механизм полноты комплекта, а не папка с PDF',
    body: 'Пакет документов должен отвечать на вопрос, что уже подтверждено, чего не хватает и что именно блокирует следующий денежный шаг.',
    actions: [
      { href: '/platform-v4/documents', label: 'Открыть комплект', primary: true },
      { href: '/platform-v4/deal', label: 'Назад к сделке' },
      { href: '/platform-v4/bank', label: 'Открыть money rail' },
    ],
    tiles: [
      { href: '/platform-v4/documents', kpi: '92%', label: 'Комплект собран', hint: 'но не полный', chip: 'gate', tone: 'warning' },
      { href: '/platform-v4/documents', kpi: '2', label: 'Документа блокируют release', hint: 'акт + подтверждение', chip: 'blocker', tone: 'danger' },
      { href: '/platform-v4/control', kpi: '1', label: 'Документ влияет на dispute', hint: 'evidence linkage', chip: 'evidence', tone: 'info' },
      { href: '/platform-v4/bank', kpi: '1', label: 'Money impact уже посчитан', hint: 'по событию комплекта', chip: 'money', tone: 'success' },
    ],
  },
  '/platform-v4/control': {
    eyebrow: 'Dispute & control',
    title: 'Спор — это структурированный кейс с деньгами, SLA и доказательствами',
    body: 'Контрольный экран не должен быть чатом. Он должен показывать money impact, owner, evidence pack, сроки и итог кейса.',
    actions: [
      { href: '/platform-v4/control', label: 'Открыть кейс', primary: true },
      { href: '/platform-v4/deal', label: 'Назад к сделке' },
      { href: '/platform-v4/documents', label: 'Открыть evidence' },
    ],
    tiles: [
      { href: '/platform-v4/control', kpi: '1', label: 'Открытый кейс', hint: 'quality delta влияет на деньги', chip: 'open', tone: 'warning' },
      { href: '/platform-v4/bank', kpi: '250k', label: 'Money impact на hold', hint: 'до решения кейса', chip: 'hold', tone: 'danger' },
      { href: '/platform-v4/documents', kpi: '3', label: 'Evidence sources', hint: 'документ + GPS + quality', chip: 'evidence', tone: 'info' },
      { href: '/platform-v4/control', kpi: 'SLA', label: 'Owner и срок видны', hint: 'без hidden state', chip: 'sla', tone: 'success' },
    ],
  },
};

function buildManualMarkup(screen: (typeof MANUAL_SCREENS)[string]) {
  const actions = screen.actions
    .map((action) => `<a href="${action.href}" class="pc-v4-command-action${action.primary ? ' primary' : ''}">${action.label}</a>`)
    .join('');
  const tiles = screen.tiles
    .map((tile) => `<a href="${tile.href}" class="pc-v4-command-tile"><div class="pc-v4-command-kpi">${tile.kpi}</div><div class="pc-v4-command-label">${tile.label}</div><div class="pc-v4-command-hint">${tile.hint}</div><div class="pc-v4-command-chip ${tile.tone}">${tile.chip}</div></a>`)
    .join('');
  return `<section class="pc-v4-command pc-v4-command--manual"><div class="pc-v4-command-card"><div class="pc-v4-command-eyebrow">${screen.eyebrow}</div><div class="pc-v4-command-title">${screen.title}</div><div class="pc-v4-command-body">${screen.body}</div><div class="pc-v4-command-actions">${actions}</div><div class="pc-v4-command-grid">${tiles}</div></div></section>`;
}

export function PlatformV4Enhancer() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const root = document.querySelector('[data-platform-v4-refresh="true"]') as HTMLElement | null;
    if (!root) return;

    const html = document.documentElement;
    html.setAttribute('data-pc-v4-path', pathname || '');
    html.setAttribute('data-pc-v4-replace-legacy', FULL_REPLACE_ROUTES.has(pathname || '') ? 'true' : 'false');

    const links = ROUTES[pathname || ''] || [];
    const cards = Array.from(root.querySelectorAll('[class*="metricCard"]')) as HTMLElement[];
    const cleanups: Array<() => void> = [];

    cards.forEach((card, index) => {
      const href = links[index];
      if (!href) return;

      card.style.cursor = 'pointer';
      card.setAttribute('role', 'link');
      card.setAttribute('tabindex', '0');
      card.setAttribute('title', 'Открыть связанную очередь');

      const onClick = () => router.push(href);
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          router.push(href);
        }
      };

      card.addEventListener('click', onClick);
      card.addEventListener('keydown', onKeyDown);
      cleanups.push(() => {
        card.removeEventListener('click', onClick);
        card.removeEventListener('keydown', onKeyDown);
      });
    });

    let manualNode: HTMLElement | null = null;
    const manualScreen = MANUAL_SCREENS[pathname || ''];
    const templateShell = root.querySelector('.pc-v4-template-shell');
    if (manualScreen && templateShell) {
      manualNode = document.createElement('div');
      manualNode.innerHTML = buildManualMarkup(manualScreen);
      templateShell.insertBefore(manualNode, templateShell.firstChild);
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      if (manualNode) manualNode.remove();
      html.removeAttribute('data-pc-v4-path');
      html.removeAttribute('data-pc-v4-replace-legacy');
    };
  }, [pathname, router]);

  return null;
}
