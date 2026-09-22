'use client';

import { useEffect, useState } from 'react';
import { publicDeadline, type PublicMarketLocale } from '@/lib/platform-v7/public-market-navigation';

/** Expiry is a clock fact, not permission to close an auction or settle a Deal. */
export function PublicMarketDeadline({ endsAt, initialNow, locale }: { endsAt: string; initialNow: number; locale: PublicMarketLocale }) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 15_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [endsAt]);
  const valid = Number.isFinite(Date.parse(endsAt));
  const label = publicDeadline(endsAt, now, locale);
  const units = locale === 'ru' ? 'часы:минуты' : locale === 'en' ? 'hours:minutes' : '小时:分钟';
  return valid ? <time dateTime={endsAt} title={endsAt} aria-label={endsAt && Date.parse(endsAt) > now ? `${label} (${units})` : label}>{label}</time> : <span>{label}</span>;
}
