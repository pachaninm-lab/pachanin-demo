'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const ACTIVE_ROLE_KEY = 'pc-v7-active-role';

const ROLE_LABEL: Record<PlatformRole, string> = {
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

const AI_SCOPE: Record<PlatformRole, string[]> = {
  operator: ['Главный блокер', 'Ответственный', 'Следующий операционный шаг'],
  buyer: ['Резерв', 'Закупка', 'Документы приёмки'],
  seller: ['СДИЗ / ЭТрН', 'Причина удержания денег', 'Следующий шаг продавца'],
  logistics: ['Рейс', 'Отклонение', 'Транспортный документ'],
  driver: ['Маршрут', 'Фото события', 'Полевое подтверждение'],
  surveyor: ['Осмотр', 'Доказательства', 'Акт'],
  elevator: ['Очередь', 'Вес', 'Акт приёмки'],
  lab: ['Проба', 'Качество', 'Протокол'],
  bank: ['Основание выплаты', 'Удержание', 'Риск проверки'],
  arbitrator: ['Спорный факт', 'Доказательства', 'Решение'],
  compliance: ['Допуск', 'Полномочия', 'Стоп-фактор'],
  executive: ['Деньги под риском', 'Главный блокер', 'Приоритет'],
};

function normalizePath(value: string) {
  return value.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function activeForHref(rawHref: string) {
  if (!rawHref || rawHref === '/platform-v7/ai') return false;
  const url = new URL(rawHref, window.location.origin);
  const currentPath = normalizePath(window.location.pathname);
  const targetPath = normalizePath(url.pathname);
  const currentHash = window.location.hash || '';
  const targetHash = url.hash || '';
  if (targetHash) return currentPath === targetPath && currentHash === targetHash;
  if (currentHash && currentPath === targetPath) return false;
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

function closeDrawerSoon() {
  window.setTimeout(() => {
    document.querySelector<HTMLButtonElement>('.pc-v4-drawer button[aria-label="Закрыть меню"]')?.click();
  }, 0);
}

function readRole(fallback: PlatformRole): PlatformRole {
  const stored = window.sessionStorage.getItem(ACTIVE_ROLE_KEY) as PlatformRole | null;
  return stored && ROLE_LABEL[stored] ? stored : fallback;
}

export function PlatformV7InteractionFixes() {
  const pathname = usePathname();
  const storeRole = usePlatformV7RStore((state) => state.role);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [role, setRole] = React.useState<PlatformRole>(storeRole);
  const aiOpenRef = React.useRef(false);

  React.useEffect(() => {
    aiOpenRef.current = aiOpen;
    document.querySelectorAll<HTMLElement>('a[href="/platform-v7/ai"], .pc-v7-role-dock-item, .pc-v7-safe-drawer-link').forEach((item) => {
      if (item instanceof HTMLAnchorElement && item.getAttribute('href') === '/platform-v7/ai') {
        item.dataset.active = aiOpen ? 'true' : 'false';
        return;
      }
      if (item.classList.contains('pc-v7-role-dock-item') || item.classList.contains('pc-v7-safe-drawer-link')) {
        const href = item instanceof HTMLAnchorElement ? item.getAttribute('href') || '' : '';
        if (href) item.dataset.active = activeForHref(href) ? 'true' : 'false';
      }
    });
  }, [aiOpen, pathname]);

  React.useEffect(() => {
    const sync = () => {
      setRole(readRole(storeRole));
      document.querySelectorAll<HTMLElement>('.pc-v7-role-dock-item, .pc-v7-safe-drawer-link').forEach((item) => {
        const href = item instanceof HTMLAnchorElement ? item.getAttribute('href') || '' : '';
        if (!href) return;
        item.dataset.active = href === '/platform-v7/ai' ? (aiOpenRef.current ? 'true' : 'false') : (activeForHref(href) ? 'true' : 'false');
      });
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const aiLink = target?.closest('a[href="/platform-v7/ai"]');
      if (aiLink) {
        event.preventDefault();
        event.stopPropagation();
        setRole(readRole(storeRole));
        setAiOpen(true);
        closeDrawerSoon();
        window.setTimeout(sync, 0);
        return;
      }
      const safeLink = target?.closest('.pc-v7-safe-drawer-link[href]');
      if (safeLink) {
        setAiOpen(false);
        closeDrawerSoon();
        window.setTimeout(sync, 0);
      }
    };

    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    document.addEventListener('click', onClick, true);
    const timer = window.setInterval(sync, 500);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
      document.removeEventListener('click', onClick, true);
      window.clearInterval(timer);
    };
  }, [pathname, storeRole]);

  if (!aiOpen) return null;

  return (
    <section className="pc-v7-ai-panel-fix" aria-label="ИИ-помощник роли" role="dialog">
      <style>{`
        .pc-v7-ai-panel-fix{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 86px);z-index:130;max-width:720px;margin:0 auto;border-radius:22px;border:1px solid var(--pc-accent-border);background:var(--pc-bg-card);box-shadow:var(--pc-shadow-lg);padding:14px;display:grid;gap:10px;color:var(--pc-text-primary)}
        .pc-v7-ai-fix-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.pc-v7-ai-fix-title{display:grid;gap:2px}.pc-v7-ai-fix-title strong{font-size:14px;font-weight:950}.pc-v7-ai-fix-title span{font-size:11px;color:var(--pc-text-muted)}
        .pc-v7-ai-fix-close{min-width:36px;min-height:36px;border-radius:12px;border:1px solid var(--pc-border);background:var(--pc-bg-elevated);color:var(--pc-text-secondary);font-size:20px;line-height:1;cursor:pointer}
        .pc-v7-ai-fix-list{display:grid;gap:7px;margin:0;padding:0;list-style:none}.pc-v7-ai-fix-list li{padding:9px 10px;border-radius:14px;background:var(--pc-accent-bg);border:1px solid var(--pc-accent-border);font-size:12px;line-height:1.35;font-weight:800;color:var(--pc-accent-strong)}
      `}</style>
      <div className="pc-v7-ai-fix-head">
        <div className="pc-v7-ai-fix-title"><strong>ИИ-помощник роли: {ROLE_LABEL[role]}</strong><span>Работает только внутри текущего личного кабинета.</span></div>
        <button type="button" className="pc-v7-ai-fix-close" onClick={() => setAiOpen(false)} aria-label="Закрыть ИИ-помощник">×</button>
      </div>
      <ul className="pc-v7-ai-fix-list">{(AI_SCOPE[role] ?? AI_SCOPE.operator).map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}
