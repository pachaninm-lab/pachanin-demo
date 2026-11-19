import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';
import { getGektaFaqSchema, getGektaMetadata, safeJsonLd } from '@/lib/gekta/seo';
import { GektaDiscoverySections } from './GektaDiscoverySections';
import { ABOUT_LABELS } from './GektaHomeLinks';

export function getGektaAboutMetadata(locale: GektaLocale): Metadata {
  const ui = ABOUT_LABELS[locale];
  const base = getGektaMetadata(locale);
  const path = GEKTA_PATHS[locale] + '/about';
  return { ...base, title: { absolute: ui.title }, description: ui.description,
    alternates: { canonical: path, languages: { 'ru-RU': '/gekta/about', en: '/gekta/en/about', 'zh-CN': '/gekta/zh/about', 'x-default': '/gekta/about' } },
    openGraph: { ...base.openGraph, title: ui.title, description: ui.description, url: path },
    twitter: { card: 'summary', title: ui.title, description: ui.description } };
}

export function GektaAboutPage({ locale }: { locale: GektaLocale }) {
  const ui = ABOUT_LABELS[locale];
  return <main lang={locale === 'zh' ? 'zh-CN' : locale}>
    <div className='mx-auto max-w-6xl px-4 py-4 sm:px-6'>
      <Link href={GEKTA_PATHS[locale]} className='inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-emerald-800'><ArrowLeft size={17} aria-hidden='true' />{ui.back}</Link>
      <h1 className='my-3 text-3xl font-semibold text-slate-950'>{ui.title}</h1>
    </div>
    <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(getGektaFaqSchema(locale)) }} />
    <GektaDiscoverySections locale={locale} />
  </main>;
}
