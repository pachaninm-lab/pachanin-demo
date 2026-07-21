'use client';

import * as React from 'react';
import { CheckCircle2, Sparkles, TriangleAlert } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';

type Locale = 'ru' | 'en' | 'zh';
type Mode = 'metrics' | 'status';

const COPY = {
  ru: {
    label: 'TAI · интеллектуальный контроль',
    demo: 'Публичный пример',
    title: 'Контур сделки проанализирован',
    blocker: '1 блокер требует внимания',
    confirmed: '3 основания сценария подтверждены',
    next: 'Следующее действие определено',
    metrics: ['10 этапов исполнения', '12 ролевых контекстов', 'Проверка оснований и рисков'],
  },
  en: {
    label: 'TAI · intelligent control',
    demo: 'Public example',
    title: 'Deal contour analysed',
    blocker: '1 blocker needs attention',
    confirmed: '3 scenario grounds confirmed',
    next: 'Next action identified',
    metrics: ['10 execution stages', '12 role contexts', 'Grounds and risk checks'],
  },
  zh: {
    label: 'TAI · 智能控制',
    demo: '公开示例',
    title: '交易流程已分析',
    blocker: '1 个阻塞项需要处理',
    confirmed: '示例中的 3 项依据已确认',
    next: '下一步操作已确定',
    metrics: ['10 个执行阶段', '12 个角色上下文', '依据与风险检查'],
  },
} as const;

export function PublicHeroIntelligenceStatus({ locale, mode }: { locale: string; mode: Mode }) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const copy = COPY[localeKey];
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (mode !== 'status') return;
    const node = ref.current;
    if (!node) return;
    let sent = false;
    const observer = new IntersectionObserver((entries) => {
      if (sent || !entries.some((entry) => entry.isIntersecting)) return;
      sent = true;
      trackEvent('home_intelligence_seen', { surface: 'hero', locale: localeKey, dataMode: 'public_example' });
      observer.disconnect();
    }, { threshold: 0.45 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [localeKey, mode]);

  if (mode === 'metrics') {
    return (
      <div className='pc-public-hero-metrics' aria-label={copy.metrics.join('. ')}>
        {copy.metrics.map((metric) => <span key={metric}>{metric}</span>)}
      </div>
    );
  }

  return (
    <aside ref={ref} className='pc-public-hero-intelligence' aria-label={copy.label} data-demo='true'>
      <div className='pc-public-hero-intelligence-heading'>
        <span className='pc-public-hero-intelligence-mark' aria-hidden='true'><Sparkles size={17} /></span>
        <div>
          <strong>{copy.label}</strong>
          <small>{copy.demo}</small>
        </div>
      </div>
      <p>{copy.title}</p>
      <ul>
        <li data-tone='attention'><TriangleAlert size={15} aria-hidden='true' /><span>{copy.blocker}</span></li>
        <li><CheckCircle2 size={15} aria-hidden='true' /><span>{copy.confirmed}</span></li>
        <li><CheckCircle2 size={15} aria-hidden='true' /><span>{copy.next}</span></li>
      </ul>
    </aside>
  );
}
