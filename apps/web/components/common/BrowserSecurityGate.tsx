'use client';

import * as React from 'react';
import {
  BROWSER_SECURITY_FEATURE_REASONS,
  missingBrowserSecurityFeatures,
  type BrowserSecurityFeature,
} from '@/lib/browser-security-capabilities';

/**
 * ASVS V3.7.5. When the browser does not provide a security feature this
 * surface depends on, the surface says so and refuses, rather than crashing on
 * a missing API or quietly substituting a weaker one.
 *
 * The check runs after mount on purpose. On the server there is no browser to
 * ask, so the first render must match what the server produced; deciding during
 * render would trade a documented refusal for a hydration mismatch.
 */
export function BrowserSecurityGate({
  features = ['secureContext', 'randomUUID'],
  children,
  title = 'Браузер не поддерживает требуемую защиту',
  intro = 'Это действие недоступно в текущем браузере или по незащищённому соединению. Откройте страницу по HTTPS в актуальном браузере.',
}: {
  features?: readonly BrowserSecurityFeature[];
  children: React.ReactNode;
  title?: string;
  intro?: string;
}) {
  const [missing, setMissing] = React.useState<readonly BrowserSecurityFeature[] | null>(null);
  // A stable key for a list that is a literal at every call site, so the check
  // runs when the requirement changes and not on every render.
  const requested = features.join(',');

  React.useEffect(() => {
    setMissing(missingBrowserSecurityFeatures(undefined, requested.split(',') as BrowserSecurityFeature[]));
  }, [requested]);

  if (missing === null || missing.length === 0) return <>{children}</>;

  return (
    <div role='alert' data-testid='browser-security-gate' className='rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm'>
      <p className='font-semibold text-slate-900'>{title}</p>
      <p className='mt-1 text-slate-700'>{intro}</p>
      <ul className='mt-2 list-disc pl-5 text-xs text-slate-600'>
        {missing.map((feature) => (
          <li key={feature}>{BROWSER_SECURITY_FEATURE_REASONS[feature]}</li>
        ))}
      </ul>
    </div>
  );
}
