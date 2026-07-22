'use client';

import * as React from 'react';
import { CheckCircle2, Sparkles, TriangleAlert } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';

type Locale = 'ru' | 'en' | 'zh';
type Mode = 'metrics' | 'status';

const COPY = {
  ru: {
    label: 'TAI · контроль исполнения сделки',
    demo: 'Публичный пример',
    title: 'Проверка сделки завершена',
    blocker: '1 вопрос требует решения',
    confirmed: '3 основания подтверждены',
    next: 'Следующий шаг определён',
    introTitle: 'TAI — операционный ИИ платформы',
    introText: 'Проверяет данные и документы сделки, находит расхождения, объясняет причины блокировок и предлагает следующий шаг. Критические действия подтверждает человек.',
    metrics: ['Данные сделки', 'Документы и статусы', 'Риски и следующий шаг'],
  },
  en: {
    label: 'TAI · deal execution control',
    demo: 'Public example',
    title: 'Deal check completed',
    blocker: '1 issue needs a decision',
    confirmed: '3 grounds confirmed',
    next: 'The next step is defined',
    introTitle: 'TAI is the platform operations AI',
    introText: 'It checks deal data and documents, finds discrepancies, explains blockers, and proposes the next step. A person confirms critical actions.',
    metrics: ['Deal data', 'Documents and statuses', 'Risks and next step'],
  },
  zh: {
    label: 'TAI · 交易执行控制',
    demo: '公开示例',
    title: '交易检查已完成',
    blocker: '1 个问题需要处理',
    confirmed: '3 项依据已确认',
    next: '下一步已确定',
    introTitle: 'TAI 是平台的运营型人工智能',
    introText: '它检查交易数据和文件，发现差异，解释阻塞原因并提出下一步操作。关键操作由人工确认。',
    metrics: ['交易数据', '文件与状态', '风险与下一步'],
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
      <section className='pc-public-tai-intro' aria-labelledby='pc-public-tai-intro-title'>
        <div className='pc-public-tai-intro-heading'>
          <span aria-hidden='true'><Sparkles size={18} /></span>
          <strong id='pc-public-tai-intro-title'>{copy.introTitle}</strong>
        </div>
        <p>{copy.introText}</p>
        <div className='pc-public-hero-metrics' aria-label={copy.metrics.join('. ')}>
          {copy.metrics.map((metric) => <span key={metric}>{metric}</span>)}
        </div>
      </section>
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
