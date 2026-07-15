'use client';

import { PublicDealExplorer } from '@/components/platform-v7/PublicDealExplorer';
import type { PublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';
import type { TourState } from '@/lib/platform-v7/public-product-experience-state';

export function PublicDealExplorerV4({
  copy,
  locale,
  initialState,
}: {
  copy: PublicProductExperienceCopy;
  locale: string;
  initialState: TourState;
}) {
  const ui = getPublicProductExperienceV4Copy(locale);
  const adaptedCopy: PublicProductExperienceCopy = {
    ...copy,
    explorer: {
      ...copy.explorer,
      connect: ui.explorer.connect,
      controls: {
        ...copy.explorer.controls,
        lens: ui.explorer.lensLabel,
        perspective: ui.explorer.roleLabel,
        scenario: ui.explorer.scenarioLabel,
        startGuide: ui.explorer.startGuide,
      },
      scenarios: {
        standard: {
          ...copy.explorer.scenarios.standard,
          label: ui.explorer.scenarios.standard,
        },
        partial: {
          ...copy.explorer.scenarios.partial,
          label: ui.explorer.scenarios.partial,
        },
        dispute: {
          ...copy.explorer.scenarios.dispute,
          label: ui.explorer.scenarios.dispute,
        },
      },
    },
  };

  return <PublicDealExplorer copy={adaptedCopy} locale={locale} initialState={initialState} />;
}
