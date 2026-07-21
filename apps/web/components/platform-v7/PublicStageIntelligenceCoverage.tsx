'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';

type Locale = 'ru' | 'en' | 'zh';

type Stage = {
  id: string;
  label: string;
};

const COVERAGE: Record<Locale, Record<string, string>> = {
  ru: {
    terms: 'проверяет полноту и противоречия',
    admission: 'проверяет полномочия и ограничения',
    auction: 'сопоставляет предложения',
    deal: 'контролирует обязательства и сроки',
    logistics: 'выявляет задержки и изменение маршрута',
    acceptance: 'сверяет время, массу и основание',
    laboratory: 'сопоставляет показатели качества',
    documents: 'проверяет комплектность и реквизиты',
    settlement: 'проверяет наступление денежных оснований',
    dispute: 'собирает хронологию и доказательства',
  },
  en: {
    terms: 'checks completeness and contradictions',
    admission: 'checks authority and restrictions',
    auction: 'compares offers',
    deal: 'controls obligations and deadlines',
    logistics: 'detects delays and route changes',
    acceptance: 'reconciles time, weight, and grounds',
    laboratory: 'compares quality indicators',
    documents: 'checks completeness and details',
    settlement: 'checks whether payment grounds have occurred',
    dispute: 'builds the chronology and evidence',
  },
  zh: {
    terms: '检查完整性与矛盾',
    admission: '检查权限与限制',
    auction: '比对报价',
    deal: '控制义务与期限',
    logistics: '发现延误和路线变化',
    acceptance: '核对时间、重量和依据',
    laboratory: '比对质量指标',
    documents: '检查文件完整性和信息',
    settlement: '检查付款依据是否成立',
    dispute: '汇总时间线和证据',
  },
};

const LABEL = {
  ru: 'TAI на этапе',
  en: 'TAI at this stage',
  zh: '本阶段的 TAI',
} as const;

export function PublicStageIntelligenceCoverage({ locale, stages }: { locale: string; stages: readonly Stage[] }) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const [activeStage, setActiveStage] = React.useState(stages[0]?.id || 'terms');
  const active = stages.find((stage) => stage.id === activeStage) || stages[0];
  if (!active) return null;

  return (
    <div className='pc-public-stage-coverage'>
      <div className='pc-public-stage-coverage-line' role='tablist' aria-label={LABEL[localeKey]}>
        {stages.map((stage, index) => (
          <button
            key={stage.id}
            type='button'
            role='tab'
            aria-selected={activeStage === stage.id}
            aria-controls='pc-public-stage-coverage-description'
            data-active={activeStage === stage.id ? 'true' : 'false'}
            onClick={() => {
              setActiveStage(stage.id);
              trackEvent('home_intelligence_source_opened', { surface: 'stage_path', stage: stage.id, locale: localeKey });
            }}
          >
            <span>{index + 1}</span>
            <small>{stage.label}</small>
          </button>
        ))}
      </div>
      <div id='pc-public-stage-coverage-description' className='pc-public-stage-coverage-description' role='tabpanel' aria-live='polite'>
        <Sparkles size={16} aria-hidden='true' />
        <strong>{LABEL[localeKey]}</strong>
        <span>{active.label}: {COVERAGE[localeKey][active.id] || COVERAGE[localeKey].deal}</span>
      </div>
    </div>
  );
}
