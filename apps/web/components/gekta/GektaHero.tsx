import { getGektaCopy, type GektaLocale } from '@/lib/gekta/content';
import { GektaProductCta } from './GektaProductCta';

export function GektaHero({ locale }: { locale: GektaLocale }) {
  const copy = getGektaCopy(locale);
  return (
    <header className='mx-auto w-full max-w-4xl px-4 pt-10 text-center sm:px-6 sm:pt-14' data-gekta-server-hero='true'>
      <p className='text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800'>{copy.brandLine}</p>
      <h1 className='mx-auto mt-4 max-w-4xl text-balance text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl'>{copy.h1}</h1>
      <p className='mx-auto mt-5 max-w-3xl text-pretty text-base leading-7 text-slate-600 sm:text-lg sm:leading-8'>{copy.lead}</p>
      <p className='mt-4 text-sm text-slate-500'>{copy.maker}</p>
      <GektaProductCta locale={locale} variant='hero' />
    </header>
  );
}
