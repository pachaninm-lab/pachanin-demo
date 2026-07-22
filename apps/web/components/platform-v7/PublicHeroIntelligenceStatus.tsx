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
    title: 'Проверка сделки завершена',
    blocker: '1 вопрос требует решения',
    confirmed: '3 основания подтверждены',
    next: 'Следующий шаг понятен',
    introTitle: 'TAI — интеллектуальная система платформы',
    introText: 'Она читает доступные данные сделки, находит несоответствия, объясняет риски и помогает понять, что делать дальше.',
    metrics: ['10 этапов сделки', '12 ролей участников', 'Контроль оснований и рисков'],
  },
  en: {
    label: 'TAI · intelligent control',
    demo: 'Public example',
    title: 'Deal check completed',
    blocker: '1 issue needs a decision',
    confirmed: '3 grounds confirmed',
    next: 'The next step is clear',
    introTitle: 'TAI is the platform intelligence system',
    introText: 'It reads available deal data, finds inconsistencies, explains risks, and helps users understand what to do next.',
    metrics: ['10 deal stages', '12 participant roles', 'Grounds and risk control'],
  },
  zh: {
    label: 'TAI · 智能控制',
    demo: '公开示例',
    title: '交易检查已完成',
    blocker: '1 个问题需要处理',
    confirmed: '3 项依据已确认',
    next: '下一步已明确',
    introTitle: 'TAI 是平台的智能系统',
    introText: '它读取可用的交易数据，发现不一致，解释风险，并帮助用户明确下一步操作。',
    metrics: ['10 个交易阶段', '12 个参与方角色', '依据与风险控制'],
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
      <div className='pc-public-tai-intro' role='note' aria-label={copy.introTitle}>
        <div className='pc-public-tai-intro-heading'>
          <span aria-hidden='true'><Sparkles size={17} /></span>
          <strong>{copy.introTitle}</strong>
        </div>
        <p>{copy.introText}</p>
        <div className='pc-public-hero-metrics' aria-label={copy.metrics.join('. ')}>
          {copy.metrics.map((metric) => <span key={metric}>{metric}</span>)}
        </div>
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
