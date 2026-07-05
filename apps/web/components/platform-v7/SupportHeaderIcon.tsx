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
        .p7-role-support{display:inline-flex!important;flex:0 0 auto!important}
        @media(max-width:767px){.p7-role-support{display:none!important}}
      ` }} />
      {mount ? createPortal(button, mount) : null}
    </>
  );
}
