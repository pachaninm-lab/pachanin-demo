'use client';

import { useState } from 'react';
import type { PublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';
import { PublicExperienceIcon } from '@/components/platform-v7/PublicExperienceIcon';
import {
  PublicDealIntelligencePanel,
  type PublicDealLens,
} from '@/components/platform-v7/PublicDealIntelligencePanel';

const previewLenses: readonly PublicDealLens[] = ['execution', 'documents', 'money', 'risk'];

const onboardingCopy = {
  ru: {
    selectedStage: 'Выбранный ключевой этап',
    start: 'Разобрать пример сделки',
    current: 'Открыть этап приёмки',
  },
  en: {
    selectedStage: 'Highlighted key stage',
    start: 'Analyse the example deal',
    current: 'Open the acceptance stage',
  },
  zh: {
    selectedStage: '当前重点阶段',
    start: '分析示例交易',
    current: '打开验收阶段',
  },
} as const;

function emit(name: string, detail: Record<string, string> = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
    detail: {
      name,
      viewport_group: window.innerWidth < 720 ? 'mobile' : window.innerWidth < 1100 ? 'tablet' : 'desktop',
      ...detail,
    },
  }));
}

export function PublicDealPreview({ copy, locale }: { copy: PublicProductExperienceCopy; locale: string }) {
  const [lens, setLens] = useState<PublicDealLens>('execution');
  const ui = getPublicProductExperienceV4Copy(locale);
  const preview = ui.home.preview;
  const language = onboardingCopy[locale === 'en' || locale === 'zh' ? locale : 'ru'];
  const startHref = `/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&entry=deal&stage=terms&lens=execution&perspective=buyer`;
  const acceptanceHref = `/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&entry=deal&stage=acceptance&lens=${lens}&perspective=buyer&risk=weightMismatch`;

  return (
    <article
      className='pc-ppe-preview-card pc-public-deal-preview-card'
      aria-labelledby='pc-ppe-preview-title'
      aria-label={`${copy.header.aria}: ${preview.demoLabel}`}
    >
      <div className='pc-ppe-preview-topline'>
        <span className='pc-ppe-example-badge'>{preview.demoLabel}</span>
        <span className='pc-ppe-preview-scenario'>{preview.scenarioLabel}</span>
      </div>
      <p className='pc-ppe-demo-note'>{preview.demoNote}</p>

      <div className='pc-ppe-preview-heading'>
        <div>
          <h2 id='pc-ppe-preview-title'>{preview.title}</h2>
          <p>{preview.price}</p>
        </div>
        <span className='pc-ppe-route'>{preview.route}</span>
      </div>

      <div className='pc-public-deal-intelligence-layout'>
        <div className='pc-public-deal-core'>
          <div className='pc-ppe-preview-perspective'>
            <div>
              <span>{preview.perspectiveLabel}</span>
              <strong>{preview.perspectiveValue}</strong>
            </div>
            <a href='#participants'>{preview.changePerspective}</a>
          </div>

          <div className='pc-ppe-preview-progress' aria-label={`${language.selectedStage}: ${preview.stageCounter}`}>
            <span>{language.selectedStage}: {preview.stageCounter}</span>
            <strong>{preview.nowValue}</strong>
            <small>{preview.nextPrefix}: {preview.afterValue}</small>
          </div>

          <dl className='pc-ppe-preview-status'>
            <div><dt>{preview.nowLabel}</dt><dd>{preview.nowValue}</dd></div>
            <div><dt>{preview.requiredLabel}</dt><dd>{preview.requiredValue}</dd></div>
            <div><dt>{preview.ownerLabel}</dt><dd>{preview.ownerValue}</dd></div>
            <div><dt>{preview.deadlineLabel}</dt><dd>{preview.deadlineValue}</dd></div>
            <div><dt>{preview.afterLabel}</dt><dd>{preview.afterValue}</dd></div>
            <div className='pc-ppe-preview-settlement'><dt>{preview.settlementLabel}</dt><dd>{preview.settlementValue}</dd></div>
          </dl>

          <div className='pc-ppe-preview-lenses' role='tablist' aria-label={preview.lensAria}>
            {previewLenses.map((key) => (
              <button
                key={key}
                id={`pc-ppe-preview-tab-${key}`}
                type='button'
                role='tab'
                aria-selected={lens === key}
                aria-controls='pc-ppe-preview-detail'
                className='pc-ppe-chip-button'
                data-active={lens === key ? 'true' : 'false'}
                onClick={() => {
                  setLens(key);
                  emit('lens_selected', { locale, lens: key, source: 'home_preview' });
                  emit('deal_intelligence_lens_changed', { locale, lens: key, source: 'home_preview' });
                }}
              >
                <PublicExperienceIcon name={key} size={18} />
                <span>{preview.lenses[key].label}</span>
              </button>
            ))}
          </div>

          <div
            id='pc-ppe-preview-detail'
            className='pc-ppe-preview-detail pc-public-deal-detail'
            role='tabpanel'
            aria-labelledby={`pc-ppe-preview-tab-${lens}`}
            aria-live='polite'
          >
            <PublicExperienceIcon name={lens} size={24} />
            <div>
              <strong>{preview.lenses[lens].label}</strong>
              <span>{preview.lenses[lens].value}</span>
            </div>
          </div>

          <div className='pc-ppe-preview-actions pc-public-deal-actions'>
            <a
              className='pc-ppe-primary-button'
              href={startHref}
              onClick={() => emit('deal_xray_open', { locale, lens: 'execution', stage: 'terms', source: 'home_preview_start' })}
            >
              <span>{language.start}</span>
              <PublicExperienceIcon name='arrow' size={19} />
            </a>
            <a
              className='pc-ppe-inline-link'
              href={acceptanceHref}
              onClick={() => emit('deal_xray_open', { locale, lens, stage: 'acceptance', source: 'home_preview_stage' })}
            >
              <span>{language.current}</span>
              <PublicExperienceIcon name='arrow' size={19} />
            </a>
          </div>
        </div>

        <PublicDealIntelligencePanel locale={locale} lens={lens} />
      </div>
    </article>
  );
}
