'use client';

import { useState } from 'react';
import type { PublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';
import { PublicExperienceIcon } from '@/components/platform-v7/PublicExperienceIcon';

const previewLenses = ['execution', 'documents', 'money', 'risk'] as const;
type PreviewLens = (typeof previewLenses)[number];

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
  const [lens, setLens] = useState<PreviewLens>('execution');
  const ui = getPublicProductExperienceV4Copy(locale);
  const preview = ui.home.preview;

  return (
    <article
      className='pc-ppe-preview-card'
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

      <div className='pc-ppe-preview-perspective'>
        <div>
          <span>{preview.perspectiveLabel}</span>
          <strong>{preview.perspectiveValue}</strong>
        </div>
        <a href='#participants'>{preview.changePerspective}</a>
      </div>

      <div className='pc-ppe-preview-progress' aria-label={preview.stageCounter}>
        <span>{preview.stageCounter}</span>
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
            type='button'
            role='tab'
            aria-selected={lens === key}
            aria-controls='pc-ppe-preview-detail'
            className='pc-ppe-chip-button'
            data-active={lens === key ? 'true' : 'false'}
            onClick={() => {
              setLens(key);
              emit('lens_selected', { locale, lens: key, source: 'home_preview' });
            }}
          >
            <PublicExperienceIcon name={key} size={18} />
            <span>{preview.lenses[key].label}</span>
          </button>
        ))}
      </div>

      <div id='pc-ppe-preview-detail' className='pc-ppe-preview-detail' role='tabpanel' aria-live='polite'>
        <PublicExperienceIcon name={lens} size={24} />
        <div>
          <strong>{preview.lenses[lens].label}</strong>
          <span>{preview.lenses[lens].value}</span>
        </div>
      </div>

      <a
        className='pc-ppe-inline-link'
        href={`/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&entry=deal&lens=${lens}&perspective=buyer`}
        onClick={() => emit('deal_xray_open', { locale, lens, source: 'home_preview' })}
      >
        <span>{preview.open}</span>
        <PublicExperienceIcon name='arrow' size={19} />
      </a>
    </article>
  );
}
