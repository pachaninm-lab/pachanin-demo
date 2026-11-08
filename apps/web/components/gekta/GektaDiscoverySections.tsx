import Link from 'next/link';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { GEKTA_PATHS, GEKTA_TOPICS, getGektaCopy, type GektaLocale } from '@/lib/gekta/content';
import { getGektaProductCopy } from '@/lib/gekta/product-copy';
import { GektaCapabilities } from './GektaCapabilities';
import { GektaLegalFooter } from './GektaLegalFooter';

export function GektaDiscoverySections({ locale }: { locale: GektaLocale }) {
  const copy = getGektaCopy(locale);
  const product = getGektaProductCopy(locale);
  const isRu = locale === 'ru';
  const trustLabel = locale === 'en' ? 'How Gekta handles data and security' : locale === 'zh' ? 'Gekta 如何处理数据与安全' : 'Как Гекта работает с данными и безопасностью';
  const trustHref = `${GEKTA_PATHS[locale]}/security`;

  return (
    <div className='border-t border-slate-200/80 bg-[#fbfaf5]' data-gekta-server-discovery='true'>
      <section className='mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24'>
        <div className='max-w-3xl'>
          <h2 className='text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl'>{copy.marketingTitle}</h2>
          {copy.marketingText.map((paragraph) => <p key={paragraph} className='mt-5 text-base leading-7 text-slate-600'>{paragraph}</p>)}
        </div>
        <div className='mt-10 grid gap-4 md:grid-cols-2'>
          {copy.valueCards.map(([title, text]) => (
            <article key={title} className='rounded-3xl border border-slate-200 bg-white p-6 shadow-sm'>
              <CheckCircle2 className='h-5 w-5 text-emerald-700' aria-hidden='true' />
              <h3 className='mt-4 text-lg font-semibold text-slate-950'>{title}</h3>
              <p className='mt-2 leading-7 text-slate-600'>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <GektaCapabilities locale={locale} />

      {isRu ? (
        <section className='border-b border-slate-200/80 bg-white' aria-labelledby='gekta-topics-title'>
          <div className='mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24'>
            <h2 id='gekta-topics-title' className='text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl'>Разберитесь в отдельном направлении</h2>
            <div className='mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {GEKTA_TOPICS.map((topic) => (
                <Link key={topic.slug} href={`/gekta/${topic.slug}`} className='group flex min-h-24 items-center justify-between rounded-2xl border border-slate-200 bg-[#fbfaf5] px-5 py-4 text-sm font-medium text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50'>
                  <span>{topic.h1}</span><ArrowRight className='ml-3 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5' aria-hidden='true' />
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className='mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24' aria-labelledby='gekta-audience-title'>
        <h2 id='gekta-audience-title' className='text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl'>{copy.audienceTitle}</h2>
        <p className='mt-5 max-w-4xl text-base leading-7 text-slate-600'>{product.audienceLead}</p>
        <div className='mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {product.audienceCards.map((card) => (
            <article key={card.role} className='rounded-3xl border border-slate-200 bg-white p-6'>
              <h3 className='text-base font-semibold text-slate-950'>{card.role}</h3>
              <p className='mt-2 text-sm leading-6 text-slate-600'>{card.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className='border-y border-emerald-900/10 bg-[#eff5ee]'>
        <div className='mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-24'>
          <div><ShieldCheck className='h-8 w-8 text-emerald-800' aria-hidden='true' /><h2 className='mt-5 text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl'>{copy.trustTitle}</h2></div>
          <div>{copy.trustText.map((paragraph) => <p key={paragraph} className='mb-5 text-base leading-7 text-slate-700'>{paragraph}</p>)}<Link href={trustHref} className='inline-flex min-h-11 items-center gap-2 font-semibold text-emerald-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700'>{trustLabel}<ArrowRight className='h-4 w-4' aria-hidden='true' /></Link></div>
        </div>
      </section>

      <section className='mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24'>
        <h2 className='text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl'>{copy.howTitle}</h2>
        <div className='mt-10 grid gap-4 md:grid-cols-3'>{copy.how.map(([title, text]) => <article key={title} className='rounded-3xl border border-slate-200 bg-white p-6'><h3 className='text-lg font-semibold text-slate-950'>{title}</h3><p className='mt-3 leading-7 text-slate-600'>{text}</p></article>)}</div>
        <p className='mt-8 max-w-4xl rounded-2xl bg-slate-950 px-6 py-5 leading-7 text-white'>{copy.principle}</p>
      </section>

      <section className='border-y border-slate-200 bg-white'>
        <div className='mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24'>
          <h2 className='text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl'>{copy.creatorTitle}</h2>
          <div className='mt-5 max-w-4xl space-y-4 text-base leading-7 text-slate-600'>{copy.creatorText.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        </div>
      </section>

      <section className='mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-24'>
        <h2 className='text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl'>{copy.faqTitle}</h2>
        <div className='mt-8 divide-y divide-slate-200 border-y border-slate-200'>{copy.faq.map(([question, answer]) => <details key={question} className='group py-5'><summary className='cursor-pointer list-none pr-8 text-base font-semibold text-slate-950 marker:hidden'>{question}</summary><p className='mt-3 max-w-3xl leading-7 text-slate-600'>{answer}</p></details>)}</div>
      </section>

      <GektaLegalFooter locale={locale} />
    </div>
  );
}
