'use client';

import Link from 'next/link';
import { CircleHelp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const SUPPORT_BY_ROLE: Record<PlatformRole, { label: string }> = {
  operator: { label: 'Статус и помощь оператора' },
  buyer: { label: 'Статус и помощь покупателя' },
  seller: { label: 'Статус и помощь продавца' },
  logistics: { label: 'Статус и помощь логистики' },
  driver: { label: 'Статус и помощь водителя' },
  surveyor: { label: 'Статус и помощь сюрвейера' },
  elevator: { label: 'Статус и помощь приёмки' },
  lab: { label: 'Статус и помощь лаборатории' },
  bank: { label: 'Статус и помощь банковской проверки' },
  arbitrator: { label: 'Статус и помощь арбитража' },
  compliance: { label: 'Статус и помощь комплаенса' },
  executive: { label: 'Статус и помощь руководителя' },
};

function useHeaderActionsMount() {
  const [mount, setMount] = useState<Element | null>(null);
  useEffect(() => {
    const sync = () => setMount(document.querySelector('.pc-v4-actions'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return mount;
}

export function SupportHeaderIcon() {
  const role = usePlatformV7RStore((state) => state.role) || 'operator';
  const support = SUPPORT_BY_ROLE[role];
  const mount = useHeaderActionsMount();
  const button = (
    <Link href={`/platform-v7/status?role=${role}`} className='p7-role-support pc-v4-iconbtn' aria-label={support.label} title={support.label}>
      <CircleHelp size={18} strokeWidth={2.35} />
    </Link>
  );
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .pc-shell-root-v4 > div[aria-hidden='true']{background:rgba(15,23,42,.01)!important;box-shadow:none!important;backdrop-filter:none!important}
        .pc-v4-drawer:not([data-open='true']){box-shadow:none!important;border-right:0!important;visibility:hidden!important;pointer-events:none!important}
        .p7-role-support{display:inline-flex!important;flex:0 0 auto!important}
        .pc-v4-header{display:block!important;visibility:visible!important;opacity:1!important;position:fixed!important;inset:0 0 auto 0!important;z-index:320!important;pointer-events:auto!important}
        .pc-v4-header-inner,.pc-v4-top,.pc-v4-brand,.pc-v4-actions{visibility:visible!important;opacity:1!important}
        .pc-v4-bottomnav{display:none!important}
        .pc-v7-role-dock{display:block!important;visibility:visible!important;opacity:1!important;position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:300!important;pointer-events:auto!important}
        .pc-v4-main{padding-bottom:calc(env(safe-area-inset-bottom) + 98px)!important}
        @media(max-width:767px){
          .pc-v4-search{display:none!important}
          .pc-v4-header-inner{position:relative!important}
          .pc-v4-top{position:relative!important;width:100%!important;display:grid!important;grid-template-columns:52px 52px minmax(0,1fr)!important;gap:8px!important;align-items:center!important;min-height:44px!important}
          .pc-v4-top > button[aria-label='Открыть меню']{grid-column:1!important;justify-self:start!important;display:inline-flex!important;visibility:visible!important;opacity:1!important}
          .pc-v4-brand{grid-column:2!important;max-width:52px!important;overflow:hidden!important;justify-self:start!important;display:flex!important;visibility:visible!important;opacity:1!important}
          .pc-v4-brand .pc-v4-title,.pc-v4-brand .pc-v4-subtitle{display:none!important}
          .pc-v4-actions{position:absolute!important;top:0!important;right:max(10px,env(safe-area-inset-right))!important;height:44px!important;margin:0!important;gap:6px!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;max-width:calc(100vw - 132px)!important;z-index:3!important;visibility:visible!important;opacity:1!important}
          .pc-v4-actions > *{flex:0 0 auto!important}
          .pc-v4-actions button[aria-label='Открыть уведомления']{display:none!important}
          .pc-v4-actions button[aria-label='Идентификация и настройки']{width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;padding:4px!important;border-radius:13px!important;overflow:hidden!important;justify-content:center!important}
          .pc-v4-actions button[aria-label='Идентификация и настройки'] > span:nth-child(2),.pc-v4-actions button[aria-label='Идентификация и настройки'] > svg{display:none!important}
          .pc-v4-actions button[aria-label='Идентификация и настройки'] > span:first-child{width:28px!important;height:28px!important;font-size:9px!important}
          .p7-role-support.pc-v4-iconbtn{width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;border-radius:13px!important}
          .pc-v4-drawer{width:min(344px,84vw)!important;max-width:84vw!important;border-top-right-radius:24px!important;border-bottom-right-radius:24px!important;overflow:hidden!important}
          .pc-v4-drawer[data-open='true']{box-shadow:14px 0 34px rgba(15,23,42,.08)!important}
          .pc-v7-role-dock{padding:7px 10px calc(env(safe-area-inset-bottom) + 7px)!important;background:color-mix(in srgb,var(--pc-bg-header) 98%,transparent)!important;backdrop-filter:blur(18px)!important;border-top:1px solid var(--pc-border)!important;box-shadow:0 -10px 28px rgba(3,8,7,.10)!important}
        }
        @media(max-width:374px){.pc-v4-actions{right:6px!important;gap:5px!important;max-width:calc(100vw - 124px)!important}.p7-role-support.pc-v4-iconbtn,.pc-v4-actions button[aria-label='Идентификация и настройки']{width:40px!important;min-width:40px!important;max-width:40px!important;height:40px!important;min-height:40px!important}}
      ` }} />
      {mount ? createPortal(button, mount) : null}
    </>
  );
}
