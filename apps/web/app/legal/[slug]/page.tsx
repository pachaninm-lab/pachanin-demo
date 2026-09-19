import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { GEKTA_LEGAL_DOCUMENTS, GEKTA_LEGAL_VERSION, getGektaLegalDocument, renderLegalDocument } from '@/lib/gekta/legal';
import { getMerchantProfile } from '@/lib/gekta/merchant';

export const dynamicParams = false;

type PageProps = Readonly<{ params: Promise<{ slug: string }> }>;

export function generateStaticParams() {
  return GEKTA_LEGAL_DOCUMENTS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const document = getGektaLegalDocument(slug);
  if (!document) return {};
  return {
    title: `${document.title} — Гекта`,
    description: document.description,
    alternates: { canonical: `/legal/${document.slug}` },
    robots: { index: true, follow: true },
  };
}

export default async function GektaLegalDocumentPage({ params }: PageProps) {
  const { slug } = await params;
  const found = getGektaLegalDocument(slug);
  if (!found) notFound();
  // Реквизиты исполнителя приходят из профиля продавца, а не из текста документа.
  const document = renderLegalDocument(found, getMerchantProfile());

  return (
    <main className='min-h-screen bg-[#fbfaf5] text-slate-950'>
      <div className='mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16'>
        <Link href='/gekta' className='inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50'>
          <ArrowLeft className='h-4 w-4' aria-hidden='true' />Гекта
        </Link>
        <h1 className='mt-8 text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl'>{document.title}</h1>
        <p className='mt-4 text-base leading-7 text-slate-600'>{document.summary}</p>
        <p className='mt-3 text-xs text-slate-500'>Редакция {GEKTA_LEGAL_VERSION}</p>

        <div className='mt-10 space-y-8'>
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2 className='text-lg font-semibold text-slate-950'>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className='mt-3 leading-7 text-slate-700'>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>

        <nav className='mt-14 border-t border-slate-200 pt-6' aria-label='Документы Гекты'>
          <h2 className='text-sm font-semibold text-slate-900'>Другие документы</h2>
          <ul className='mt-3 space-y-2'>
            {GEKTA_LEGAL_DOCUMENTS.filter((item) => item.slug !== document.slug).map((item) => (
              <li key={item.slug}>
                <Link href={`/legal/${item.slug}`} className='text-sm font-medium text-emerald-800 underline-offset-4 hover:underline'>{item.title}</Link>
              </li>
            ))}
            <li><Link href='/platform-v7/contact' className='text-sm font-medium text-emerald-800 underline-offset-4 hover:underline'>Контакты поддержки</Link></li>
          </ul>
        </nav>
      </div>
    </main>
  );
}
