import { getGektaCopy, type GektaLocale } from '@/lib/gekta/content';

export function GektaHero({ locale }: { locale: GektaLocale }) {
  const copy = getGektaCopy(locale);
  return (
    <header className='mx-auto w-full max-w-4xl px-0 pt-5 text-center sm:px-6 sm:pt-12' data-gekta-server-hero='true'>
      <p className='text-[14px] font-semibold uppercase tracking-[0.1em] text-emerald-800'>{copy.brandLine}</p>
      <h1 className='mx-auto mt-3 max-w-4xl text-balance text-[34px] font-semibold leading-[1.06] tracking-[-0.045em] text-slate-950 sm:mt-4 sm:text-5xl'>{copy.h1}</h1>
      <p className='mx-auto mt-3 max-w-3xl text-pretty text-base leading-6 text-slate-600 sm:mt-5 sm:text-lg sm:leading-8'>{copy.lead}</p>
      <p className='mt-4 hidden text-[14px] leading-5 text-slate-500 sm:block'>{copy.maker}</p>
    </header>
  );
}
