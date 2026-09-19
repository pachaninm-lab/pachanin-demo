import { ChevronDown } from 'lucide-react';
import { getGektaCopy, type GektaLocale } from '@/lib/gekta/content';
import { getGektaProductCopy } from '@/lib/gekta/product-copy';

/**
 * The central capability block.
 *
 * Every line — heading, summary, the problem it solves and the concrete work
 * items — is server-rendered. The disclosure only collapses layout: a crawler
 * and a reader with JavaScript disabled still get the whole text.
 */
export function GektaCapabilities({ locale }: { locale: GektaLocale }) {
  const copy = getGektaCopy(locale);
  const product = getGektaProductCopy(locale);

  return (
    <section className='border-y border-slate-200/80 bg-white' aria-labelledby='gekta-capabilities-title'>
      <div className='mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24'>
        <h2 id='gekta-capabilities-title' className='max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl'>
          {copy.capabilityTitle}
        </h2>
        <p className='mt-5 max-w-4xl text-base leading-7 text-slate-600'>{product.capabilityLead}</p>

        <div className='mt-10 grid gap-4 lg:grid-cols-2'>
          {product.capabilityGroups.map((group) => (
            <article key={group.title} className='rounded-3xl border border-slate-200 bg-[#fbfaf5] p-6'>
              <h3 className='text-lg font-semibold text-slate-950'>{group.title}</h3>
              <p className='mt-2 leading-7 text-slate-700'>{group.summary}</p>
              <p className='mt-3 text-sm leading-6 text-slate-500'>{group.problem}</p>
              <details className='group mt-4 border-t border-slate-200 pt-3'>
                <summary className='flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-emerald-800 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
                  {product.capabilityDetailsLabel}
                  <ChevronDown className='h-4 w-4 shrink-0 transition group-open:rotate-180 motion-reduce:transition-none' aria-hidden='true' />
                </summary>
                <ul className='mt-3 space-y-2'>
                  {group.items.map((item) => (
                    <li key={item} className='relative pl-5 text-sm leading-6 text-slate-700 before:absolute before:left-0 before:top-2.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-emerald-700'>
                      {item}
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
