'use client';

import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const SUPPORT_BY_ROLE: Record<PlatformRole, { href: string; label: string }> = {
  operator: { href: '/platform-v7/support?role=operator', label: 'Поддержка оператора' },
  buyer: { href: '/platform-v7/support?role=buyer', label: 'Поддержка покупателя' },
  seller: { href: '/platform-v7/support?role=seller', label: 'Поддержка продавца' },
  logistics: { href: '/platform-v7/support?role=logistics', label: 'Поддержка логистики' },
  driver: { href: '/platform-v7/support?role=driver', label: 'Связь с диспетчером' },
  surveyor: { href: '/platform-v7/support?role=surveyor', label: 'Поддержка сюрвейера' },
  elevator: { href: '/platform-v7/support?role=elevator', label: 'Поддержка приёмки' },
  lab: { href: '/platform-v7/support?role=lab', label: 'Поддержка лаборатории' },
  bank: { href: '/platform-v7/support?role=bank', label: 'Поддержка банковской проверки' },
  arbitrator: { href: '/platform-v7/support?role=arbitrator', label: 'Поддержка арбитража' },
  compliance: { href: '/platform-v7/support?role=compliance', label: 'Поддержка комплаенса' },
  executive: { href: '/platform-v7/support?role=executive', label: 'Поддержка руководителя' },
};

const NOTIFICATION_LABELS_BY_ROLE: Record<PlatformRole, string[]> = {
  operator: ['Споры', 'Банк', 'Лаборатория', 'Логистика', 'Система'],
  buyer: ['Банк', 'Споры', 'Логистика', 'Система'],
  seller: ['Споры', 'Лаборатория', 'Логистика', 'Система'],
  logistics: ['Логистика', 'Система'],
  driver: ['Логистика', 'Система'],
  surveyor: ['Споры', 'Логистика', 'Система'],
  elevator: ['Логистика', 'Лаборатория', 'Система'],
  lab: ['Лаборатория', 'Споры', 'Система'],
  bank: ['Банк', 'Споры', 'Система'],
  arbitrator: ['Споры', 'Система'],
  compliance: ['Банк', 'Споры', 'Система'],
  executive: ['Банк', 'Споры', 'Логистика', 'Система'],
};

function useRoleAwareNotifications(role: PlatformRole) {
  useEffect(() => {
    const applyRoleFilter = () => {
      const panel = document.querySelector('.pc-v4-alert-panel');
      if (!panel) return;
      const allowed = new Set(NOTIFICATION_LABELS_BY_ROLE[role]);
      Array.from(panel.children).forEach((child, index) => {
        const element = child as HTMLElement;
        if (index === 0) {
          const title = element.querySelector('strong');
          if (title) title.textContent = `Уведомления · ${SUPPORT_BY_ROLE[role].label.replace('Поддержка ', '').replace('Связь с ', '')}`;
          return;
        }
        const heading = element.querySelector('div')?.textContent?.trim();
        element.style.display = heading && !allowed.has(heading) ? 'none' : '';
      });
    };

    applyRoleFilter();
    const observer = new MutationObserver(applyRoleFilter);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [role]);
}

function useHeaderActionsMount() {
  const [mount, setMount] = useState<Element | null>(null);

  useEffect(() => {
    const syncMount = () => setMount(document.querySelector('.pc-v4-actions'));
    syncMount();
    const observer = new MutationObserver(syncMount);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return mount;
}

export function SupportHeaderIcon() {
  const role = usePlatformV7RStore((state) => state.role) || 'operator';
  const support = SUPPORT_BY_ROLE[role];
  const headerActions = useHeaderActionsMount();
  useRoleAwareNotifications(role);

  const button = (
    <Link href={support.href} className='p7-role-support pc-v4-iconbtn' aria-label={support.label} title={support.label}>
      <LifeBuoy size={17} />
    </Link>
  );

  return (
    <>
      <style>{`
        .pc-shell-root-v4 > div[aria-hidden='true']{background:rgba(15,23,42,.04)!important;backdrop-filter:none!important}
        .p7-role-support{display:inline-flex!important;flex:0 0 auto!important}
        @media(max-width:767px){
          .pc-v4-search{display:none!important}
          .pc-v4-actions{gap:6px!important}
          .pc-v4-actions > div,
          .pc-v4-actions > a{flex:0 0 auto!important}
          .pc-v4-actions button[aria-label='Уведомления']{display:inline-flex!important}
          .pc-v4-actions > div:has(button[aria-label='Идентификация и настройки']){display:inline-flex!important;flex:0 0 auto!important}
          .pc-v4-actions button[aria-label='Идентификация и настройки']{width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;padding:4px!important;border-radius:13px!important;overflow:hidden!important;justify-content:center!important}
          .pc-v4-actions button[aria-label='Идентификация и настройки'] > span:nth-child(2),
          .pc-v4-actions button[aria-label='Идентификация и настройки'] > svg{display:none!important}
          .pc-v4-actions button[aria-label='Идентификация и настройки'] > span:first-child{width:28px!important;height:28px!important;font-size:9px!important}
          .pc-v4-drawer{width:min(344px,84vw)!important;max-width:84vw!important;border-top-right-radius:24px!important;border-bottom-right-radius:24px!important;overflow:hidden!important}
          .p7-role-support.pc-v4-iconbtn{width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;border-radius:13px!important}
          .p7-role-support:active{transform:translateY(1px)}

          main[data-testid='platform-v7-control-tower-page']{gap:12px!important}
          main[data-testid='platform-v7-control-tower-page'] > header{display:none!important}
          main[data-testid='platform-v7-control-tower-page'] > section:not(.ct-priority){display:none!important}
          main[data-testid='platform-v7-control-tower-page'] .ct-priority{padding:16px!important;border-radius:24px!important;gap:12px!important}
          main[data-testid='platform-v7-control-tower-page'] .ct-priority-main{grid-template-columns:1fr!important;gap:12px!important}
          main[data-testid='platform-v7-control-tower-page'] .ct-priority-main > div:nth-child(2){display:none!important}
          main[data-testid='platform-v7-control-tower-page'] .ct-priority h2{font-size:clamp(30px,8vw,42px)!important;line-height:1.04!important}
          main[data-testid='platform-v7-control-tower-page'] .ct-priority p{font-size:13px!important;line-height:1.45!important}
          main[data-testid='platform-v7-control-tower-page'] .ct-priority-panel{padding:14px!important;border-radius:19px!important;gap:9px!important}
          main[data-testid='platform-v7-control-tower-page'] .ct-priority-panel .ct-row:last-child{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}
          main[data-testid='platform-v7-control-tower-page'] .ct-priority-panel .ct-row:last-child a:first-child{display:none!important}
          main[data-testid='platform-v7-control-tower-page'] .ct-priority-panel .ct-row:last-child a{min-height:52px!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:14px!important;border-radius:16px!important}
        }
        @media(max-width:374px){
          .pc-v4-actions{gap:5px!important}
          .p7-role-support.pc-v4-iconbtn,
          .pc-v4-actions button[aria-label='Идентификация и настройки']{width:40px!important;min-width:40px!important;max-width:40px!important;height:40px!important;min-height:40px!important}
        }
      `}</style>
      {headerActions ? createPortal(button, headerActions) : null}
    </>
  );
}
