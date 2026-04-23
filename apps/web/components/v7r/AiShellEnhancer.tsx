'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { trackGigaChatAsked } from '@/lib/analytics/track';

const ROLE_LABELS: Record<PlatformRole, string> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логистика',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  bank: 'Банк',
  arbitrator: 'Арбитр',
  compliance: 'Комплаенс',
  executive: 'Руководитель',
};

function buildAiHref(pathname: string, role: PlatformRole, question?: string) {
  const params = new URLSearchParams();
  params.set('from', pathname);
  params.set('role', role);
  if (question) params.set('q', question);
  return `/platform-v7/ai?${params.toString()}`;
}

function screenLabel(pathname: string) {
  if (pathname.includes('/control-tower')) return 'Control Tower';
  if (pathname.includes('/deals/')) return 'Сделка';
  if (pathname.includes('/deals')) return 'Сделки';
  if (pathname.includes('/bank')) return 'Деньги';
  if (pathname.includes('/disputes')) return 'Споры';
  if (pathname.includes('/driver')) return 'Маршрут';
  if (pathname.includes('/logistics')) return 'Логистика';
  if (pathname.includes('/seller')) return 'Продавец';
  if (pathname.includes('/buyer')) return 'Покупатель';
  if (pathname.includes('/lab')) return 'Лаборатория';
  if (pathname.includes('/elevator')) return 'Приёмка';
  if (pathname.includes('/compliance')) return 'Комплаенс';
  if (pathname.includes('/executive')) return 'Сводка';
  if (pathname.includes('/connectors')) return 'Интеграции';
  return 'Текущий экран';
}

function findOpenDrawer() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('aside, nav, section, div')).filter((node) => {
    if (node.id === 'pc-context-drawer-section') return false;
    const style = window.getComputedStyle(node);
    if (style.position !== 'fixed') return false;
    const rect = node.getBoundingClientRect();
    if (rect.height < 240) return false;
    if (rect.width < 220) return false;
    if (rect.left > 32) return false;
    const navLinks = node.querySelectorAll('a[href^="/platform-v7/"]').length;
    return navLinks >= 2;
  });

  candidates.sort((a, b) => {
    const aLinks = a.querySelectorAll('a[href^="/platform-v7/"]').length;
    const bLinks = b.querySelectorAll('a[href^="/platform-v7/"]').length;
    return bLinks - aLinks;
  });

  return candidates[0] ?? null;
}

function applyCardStyles(node: HTMLElement | HTMLAnchorElement) {
  node.style.display = 'grid';
  node.style.gap = '8px';
  node.style.padding = '12px';
  node.style.borderRadius = '14px';
  node.style.border = '1px solid var(--pc-border)';
  node.style.background = 'linear-gradient(180deg, rgba(21,28,25,0.96) 0%, rgba(11,21,19,0.98) 100%)';
  node.style.textDecoration = 'none';
}

function textStyles() {
  return {
    label: 'font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:var(--pc-text-muted);',
    title: 'font-size:14px;font-weight:900;line-height:1.35;color:var(--pc-text-primary);',
    body: 'font-size:12px;line-height:1.55;color:var(--pc-text-secondary);',
    cta: 'display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 12px;border-radius:12px;border:1px solid var(--pc-accent-border);background:var(--pc-accent-bg);font-size:12px;font-weight:800;color:var(--pc-accent-strong);text-decoration:none;',
  };
}

export function AiShellEnhancer() {
  const pathname = usePathname();
  const router = useRouter();
  const role = usePlatformV7RStore((state) => state.role);
  const isAiPage = pathname.startsWith('/platform-v7/ai');

  React.useEffect(() => {
    const ensureDrawerSection = () => {
      if (isAiPage) return;
      const drawer = findOpenDrawer();
      if (!drawer) return;

      const copy = textStyles();
      let section = drawer.querySelector<HTMLElement>('#pc-context-drawer-section');
      if (!section) {
        section = document.createElement('div');
        section.id = 'pc-context-drawer-section';
        section.style.display = 'grid';
        section.style.gap = '10px';
        section.style.padding = '12px 16px 16px';
        section.style.borderTop = '1px solid var(--pc-border)';
        section.style.marginTop = '8px';
        drawer.appendChild(section);
      }

      section.innerHTML = '';

      const aiCard = document.createElement('a');
      aiCard.href = buildAiHref(pathname, role);
      applyCardStyles(aiCard);
      aiCard.innerHTML = `
        <span style="${copy.label}">AI по экрану</span>
        <span style="${copy.title}">${ROLE_LABELS[role]} · ${screenLabel(pathname)}</span>
        <span style="${copy.body}">Блокер · документы · деньги · следующий шаг</span>
      `;
      aiCard.onclick = (event) => {
        event.preventDefault();
        trackGigaChatAsked(`${role}:${pathname}:drawer_open`);
        router.push(buildAiHref(pathname, role));
      };
      section.appendChild(aiCard);

      const sticky = document.querySelector<HTMLElement>('.sticky-action');
      const stickyTitle = sticky?.querySelector<HTMLElement>('.sticky-title')?.textContent?.trim();
      const stickyHref = sticky?.querySelector<HTMLAnchorElement>('a[href]')?.getAttribute('href');
      const stickyLabel = sticky?.querySelector<HTMLAnchorElement>('a[href]')?.textContent?.trim() || 'Открыть';

      if (sticky && stickyTitle && stickyHref) {
        const nextCard = document.createElement('div');
        applyCardStyles(nextCard);
        nextCard.innerHTML = `
          <span style="${copy.label}">Следующее действие</span>
          <span style="${copy.title}">${stickyTitle}</span>
          <span style="${copy.body}">Вынесено в боковую плашку, чтобы не перекрывать рабочий экран.</span>
        `;

        const cta = document.createElement('a');
        cta.href = stickyHref;
        cta.textContent = stickyLabel;
        cta.setAttribute('style', copy.cta);
        nextCard.appendChild(cta);
        section.appendChild(nextCard);
      }
    };

    const observer = new MutationObserver(() => {
      ensureDrawerSection();
    });

    ensureDrawerSection();
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.getElementById('pc-context-drawer-section')?.remove();
    };
  }, [isAiPage, pathname, role, router]);

  if (isAiPage) return null;

  return (
    <style>{`
      .pc-giga,
      [data-pc-ai-panel='legacy'],
      #pc-ai-dock,
      .sticky-action {
        display: none !important;
      }
    `}</style>
  );
}
