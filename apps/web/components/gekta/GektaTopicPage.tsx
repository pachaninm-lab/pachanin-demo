import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { GEKTA_TOPICS, type GektaTopic } from '@/lib/gekta/content';
import { getGektaTopicSchema, safeJsonLd } from '@/lib/gekta/seo';

export function GektaTopicPage({ topic }: { topic: GektaTopic }) {
  const related = topic.related.flatMap((slug) => {
    const item = GEKTA_TOPICS.find((candidate) => candidate.slug === slug);
    return item ? [item] : [];
  });
  const promptHref = `/gekta?prompt=${encodeURIComponent(topic.prompt)}#gekta-chat`;
  return (
    <main className='min-h-screen overflow-x-clip bg-[#fbfaf5] text-slate-950'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(getGektaTopicSchema(topic)) }} />
      <div className='mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12'>
        <Link href='/gekta' className='inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'><ArrowLeft className='h-4 w-4' aria-hidden='true' />Гекта</Link>
        <p className='mt-10 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800'>ГЕКТА · Аграрный интеллект</p>
        <h1 className='mt-4 max-w-4xl text-balance text-[36px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-6xl'>{topic.h1}</h1>
        <p className='mt-6 max-w-3xl text-lg leading-8 text-slate-600'>{topic.lead}</p>
        <Link href={promptHref} className='mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-emerald-800 px-6 py-3 font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700'>Спросить Гекту по этой задаче<ArrowRight className='h-4 w-4' aria-hidden='true' /></Link>
      </div>

      <section className='border-y border-slate-200 bg-white'>
        <div className='mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20'>
          <h2 className='text-2xl font-semibold tracking-tight sm:text-3xl'>Какие задачи разбирать в диалоге</h2>
          <div className='mt-8 grid gap-4 md:grid-cols-2'>{topic.tasks.map((item) => <div key={item} className='flex gap-3 rounded-2xl border border-slate-200 p-5'><CheckCircle2 className='mt-0.5 h-5 w-5 shrink-0 text-emerald-700' aria-hidden='true' /><p className='leading-7 text-slate-700'>{item}</p></div>)}</div>
        </div>
      </section>

      <section className='mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr]'>
        <div><h2 className='text-2xl font-semibold tracking-tight sm:text-3xl'>{topic.checklistTitle}</h2><p className='mt-4 leading-7 text-slate-600'>Чем точнее исходные данные, тем легче отделить факты от предположений и не перескакивать к преждевременному выводу.</p></div>
        <ol className='space-y-3'>{topic.checklist.map((item, index) => <li key={item} className='flex gap-4 rounded-2xl bg-white p-4 shadow-sm'><span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-800'>{index + 1}</span><span className='pt-1 leading-6 text-slate-700'>{item}</span></li>)}</ol>
      </section>

      <section className='border-y border-emerald-900/10 bg-[#eff5ee]'>
        <div className='mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20'>
          <h2 className='text-2xl font-semibold tracking-tight sm:text-3xl'>Начни с конкретного вопроса</h2>
          <blockquote className='mt-6 rounded-3xl border border-emerald-900/10 bg-white p-6 text-lg leading-8 text-slate-800'>{topic.prompt}</blockquote>
          <Link href={promptHref} className='mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-emerald-800 px-6 py-3 font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700'>Открыть вопрос в Гекте<ArrowRight className='h-4 w-4' aria-hidden='true' /></Link>
        </div>
      </section>

      <section className='mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20'>
        <h2 className='text-2xl font-semibold tracking-tight sm:text-3xl'>Связанные задачи</h2>
        <div className='mt-6 grid gap-3 md:grid-cols-3'>{related.map((item) => <Link key={item.slug} href={`/gekta/${item.slug}`} className='group min-h-11 rounded-2xl border border-slate-200 bg-white p-5 font-semibold text-slate-900 hover:border-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>{item.h1}<ArrowRight className='mt-5 h-4 w-4 text-emerald-800 transition group-hover:translate-x-0.5' aria-hidden='true' /></Link>)}</div>
        <nav aria-label='Дополнительная навигация Гекты' className='mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold'>
          <Link className='inline-flex min-h-11 items-center' href='/gekta'>Все возможности Гекты</Link>
          <Link className='inline-flex min-h-11 items-center' href='/gekta/security'>Данные и безопасность</Link>
          <Link className='inline-flex min-h-11 items-center' href='/gekta/support'>Поддержка</Link>
          <Link className='inline-flex min-h-11 items-center' href='/platform-v7'>«Прозрачная Цена»</Link>
        </nav>
      </section>
    </main>
  );
}
