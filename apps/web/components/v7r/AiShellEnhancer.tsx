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

export function AiShellEnhancer() {
  const pathname = usePathname();
  const router = useRouter();
  const role = usePlatformV7RStore((state) => state.role);
  const isAiPage = pathname.startsWith('/platform-v7/ai');

  React.useEffect(() => {
    const existing = document.getElementById('pc-ai-dock');

    if (isAiPage) {
      existing?.remove();
      return;
    }

    const dock = existing ?? document.createElement('button');
    dock.id = 'pc-ai-dock';
    dock.setAttribute('type', 'button');
    dock.setAttribute('aria-label', 'Открыть AI по текущему экрану');
    dock.innerHTML = `
      <span class="pc-ai-dock__inner">
        <span class="pc-ai-dock__icon">✦</span>
        <span class="pc-ai-dock__copy">
          <span class="pc-ai-dock__title">AI по экрану · ${ROLE_LABELS[role]}</span>
          <span class="pc-ai-dock__text">${screenLabel(pathname)} · блокер · документы · деньги · следующий шаг</span>
        </span>
      </span>
    `;

    dock.onclick = (event) => {
      event.preventDefault();
      trackGigaChatAsked(`${role}:${pathname}:dock_open`);
      router.push(buildAiHref(pathname, role));
    };

    if (!existing) {
      document.body.appendChild(dock);
    }

    return () => {
      if (dock) dock.onclick = null;
    };
  }, [isAiPage, pathname, role, router]);

  if (isAiPage) return null;

  return (
    <style>{`
      .pc-giga,
      [data-pc-ai-panel='legacy'] {
        display: none !important;
      }
      .pc-shell-root {
        padding-bottom: calc(env(safe-area-inset-bottom) + 92px) !important;
      }
      #pc-ai-dock {
        position: fixed;
        left: max(12px, env(safe-area-inset-left));
        right: max(12px, env(safe-area-inset-right));
        bottom: calc(env(safe-area-inset-bottom) + 12px);
        z-index: 120;
        border: 1px solid var(--pc-accent-border);
        background: linear-gradient(180deg, rgba(9,25,21,0.98) 0%, rgba(7,18,15,0.98) 100%);
        color: var(--pc-text-primary);
        border-radius: 18px;
        box-shadow: 0 18px 40px rgba(0,0,0,0.24);
        padding: 0;
        cursor: pointer;
        backdrop-filter: blur(18px);
      }
      .pc-ai-dock__inner {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 12px;
        align-items: center;
        width: 100%;
        padding: 13px 14px;
      }
      .pc-ai-dock__icon {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: var(--pc-accent-bg);
        border: 1px solid var(--pc-accent-border);
        color: var(--pc-accent);
        font-size: 16px;
        font-weight: 900;
      }
      .pc-ai-dock__copy {
        display: grid;
        gap: 2px;
        min-width: 0;
        text-align: left;
      }
      .pc-ai-dock__title {
        font-size: 13px;
        line-height: 1.25;
        font-weight: 900;
        color: var(--pc-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pc-ai-dock__text {
        font-size: 11px;
        line-height: 1.45;
        color: var(--pc-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      @media (min-width: 961px) {
        #pc-ai-dock {
          left: 50%;
          right: auto;
          transform: translateX(-50%);
          width: min(720px, calc(100vw - 32px));
        }
      }
    `}</style>
  );
}
