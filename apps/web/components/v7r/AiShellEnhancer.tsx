'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';
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

function isQuestionChip(text: string) {
  return (
    text.includes('?') ||
    text.startsWith('Почему ') ||
    text.startsWith('Кто ') ||
    text.startsWith('Каких ') ||
    text.startsWith('Куда ') ||
    text.startsWith('Что ') ||
    text.startsWith('Есть ли ')
  );
}

export function AiShellEnhancer() {
  const pathname = usePathname();
  const router = useRouter();
  const role = usePlatformV7RStore((state) => state.role);

  React.useEffect(() => {
    const cleanups: Array<() => void> = [];

    const openAi = (question?: string) => {
      trackGigaChatAsked(`${role}:${pathname}:${question ?? 'open'}`);
      router.push(buildAiHref(pathname, role, question));
    };

    const gigaBlocks = Array.from(document.querySelectorAll<HTMLElement>('.pc-giga'));
    gigaBlocks.forEach((block) => {
      if (!block.querySelector('[data-ai-launcher="primary"]')) {
        const primary = document.createElement('button');
        primary.type = 'button';
        primary.dataset.aiLauncher = 'primary';
        primary.style.display = 'flex';
        primary.style.alignItems = 'center';
        primary.style.justifyContent = 'space-between';
        primary.style.gap = '12px';
        primary.style.width = '100%';
        primary.style.marginTop = '10px';
        primary.style.padding = '12px 14px';
        primary.style.borderRadius = '16px';
        primary.style.border = '1px solid var(--pc-accent-border)';
        primary.style.background = 'linear-gradient(180deg, rgba(126,242,196,0.12) 0%, rgba(126,242,196,0.07) 100%)';
        primary.style.boxShadow = 'var(--pc-shadow-sm)';
        primary.style.cursor = 'pointer';
        primary.style.color = 'var(--pc-text-primary)';
        primary.innerHTML = `
          <span style="display:inline-flex;align-items:center;gap:10px;min-width:0;">
            <span data-ai-icon></span>
            <span style="display:grid;text-align:left;gap:2px;min-width:0;">
              <span style="font-size:13px;font-weight:900;color:var(--pc-text-primary);">AI по роли · ${ROLE_LABELS[role]}</span>
              <span style="font-size:11px;color:var(--pc-text-secondary);line-height:1.45;">Блокеры, владелец шага, документы, деньги и следующий ход по текущему экрану.</span>
            </span>
          </span>
          <span style="display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:999px;background:var(--pc-bg-elevated);border:1px solid var(--pc-border);font-size:11px;font-weight:800;color:var(--pc-accent);white-space:nowrap;">Открыть AI</span>
        `;
        const iconMount = primary.querySelector('[data-ai-icon]');
        if (iconMount) {
          const root = document.createElement('span');
          root.style.display = 'inline-flex';
          root.style.alignItems = 'center';
          root.style.justifyContent = 'center';
          root.style.width = '34px';
          root.style.height = '34px';
          root.style.borderRadius = '999px';
          root.style.border = '1px solid var(--pc-accent-border)';
          root.style.background = 'var(--pc-bg-elevated)';
          iconMount.replaceWith(root);
          const mount = root;
          import('react-dom/client').then(({ createRoot }) => {
            const r = createRoot(mount);
            r.render(<Sparkles size={16} strokeWidth={2.1} color='var(--pc-accent)' />);
            cleanups.push(() => r.unmount());
          });
        }
        const handler = (event: Event) => {
          event.preventDefault();
          openAi();
        };
        primary.addEventListener('click', handler);
        cleanups.push(() => primary.removeEventListener('click', handler));
        block.appendChild(primary);
      }

      const clickableNodes = Array.from(block.querySelectorAll<HTMLElement>('button, a, div'));
      clickableNodes.forEach((node) => {
        const text = (node.textContent ?? '').trim();
        if (!text) return;
        if (text === 'Открыть AI' || text === 'Открыть AI-помощника') {
          if (node.dataset.aiBound === '1') return;
          node.dataset.aiBound = '1';
          node.style.cursor = 'pointer';
          const handler = (event: Event) => {
            event.preventDefault();
            openAi();
          };
          node.addEventListener('click', handler);
          cleanups.push(() => node.removeEventListener('click', handler));
          return;
        }
        if (isQuestionChip(text)) {
          if (node.dataset.aiChipBound === '1') return;
          node.dataset.aiChipBound = '1';
          node.style.cursor = 'pointer';
          const handler = (event: Event) => {
            event.preventDefault();
            openAi(text);
          };
          node.addEventListener('click', handler);
          cleanups.push(() => node.removeEventListener('click', handler));
        }
      });
    });

    const searchPanels = Array.from(document.querySelectorAll<HTMLElement>('.pc-header-search'));
    searchPanels.forEach((panel) => {
      if (panel.dataset.aiSearchBound === '1') return;
      panel.dataset.aiSearchBound = '1';
      const handler = (event: Event) => {
        event.preventDefault();
        openAi();
      };
      panel.addEventListener('dblclick', handler);
      cleanups.push(() => panel.removeEventListener('dblclick', handler));
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      document.querySelectorAll('[data-ai-launcher="primary"]').forEach((node) => node.remove());
      document.querySelectorAll<HTMLElement>('[data-ai-bound="1"]').forEach((node) => {
        delete node.dataset.aiBound;
      });
      document.querySelectorAll<HTMLElement>('[data-ai-chip-bound="1"]').forEach((node) => {
        delete node.dataset.aiChipBound;
      });
      document.querySelectorAll<HTMLElement>('[data-ai-search-bound="1"]').forEach((node) => {
        delete node.dataset.aiSearchBound;
      });
    };
  }, [pathname, role, router]);

  return null;
}
