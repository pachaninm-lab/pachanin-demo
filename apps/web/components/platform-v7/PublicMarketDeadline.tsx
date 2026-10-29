'use client';

import { useEffect, useState } from 'react';
import { publicDeadline, type PublicMarketLocale } from '@/lib/platform-v7/public-market-navigation';

/** Expiry is a clock fact, not permission to close an auction or settle a Deal. */
export function PublicMarketDeadline({ endsAt, initialNow, locale }: { endsAt: string; initialNow: number; locale: PublicMarketLocale }) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const started=performance.now();
    const update=()=>setNow(initialNow+Math.max(0,performance.now()-started));
    setNow(initialNow);
    const timer=window.setInterval(()=>{if(!document.hidden) update();},1000);
    document.addEventListener('visibilitychange',update);
    window.addEventListener('pageshow',update);
    window.addEventListener('focus',update);
    return()=>{
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange',update);
      window.removeEventListener('pageshow',update);
      window.removeEventListener('focus',update);
    };
  }, [endsAt,initialNow]);
  const valid=Number.isFinite(Date.parse(endsAt));
  const label=publicDeadline(endsAt,now,locale);
  const units=locale==='ru'?'часы:минуты':locale==='en'?'hours:minutes':'小时:分钟';
  return valid?<time dateTime={endsAt} title={endsAt} aria-label={Date.parse(endsAt)>now?`${label} (${units})`:label}>{label}</time>:<span>{label}</span>;
}
