import Link from 'next/link';
import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';
import { GEKTA_LEGAL_DOCUMENTS, GEKTA_LEGAL_VERSION } from '@/lib/gekta/legal';

const UI = {
  ru: { title: 'Документы и условия', support: 'Контакты поддержки', version: 'Редакция', pending: 'Условия подписки, пробного периода, отмены, возврата и публичная оферта публикуются до запуска приёма платежей.' },
  en: { title: 'Documents and terms', support: 'Support contacts', version: 'Revision', pending: 'Subscription, trial, cancellation, refund terms and the public offer are published before payments open.' },
  zh: { title: '文件与条款', support: '支持联系方式', version: '版本', pending: '订阅、试用、取消、退款条款与公开要约将在开放付款前发布。' },
} as const;

export function GektaLegalFooter({ locale }: { locale: GektaLocale }) {
  const ui = UI[locale];
  return (
    <footer className='border-t border-slate-200 bg-white' data-gekta-legal-footer='true'>
      <div className='mx-auto max-w-6xl px-4 py-10 sm:px-6'>
        <h2 className='text-sm font-semibold text-slate-900'>{ui.title}</h2>
        <ul className='mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
          {GEKTA_LEGAL_DOCUMENTS.map((document) => (
            <li key={document.slug}>
              <Link href={`/legal/${document.slug}`} className='inline-flex min-h-11 items-center text-sm text-slate-600 underline-offset-4 hover:text-emerald-800 hover:underline'>
                {document.title}
              </Link>
            </li>
          ))}
          <li>
            <Link href={`${GEKTA_PATHS[locale]}/support`} className='inline-flex min-h-11 items-center text-sm text-slate-600 underline-offset-4 hover:text-emerald-800 hover:underline'>
              {ui.support}
            </Link>
          </li>
        </ul>
        <p className='mt-4 text-xs leading-5 text-slate-500'>{ui.pending}</p>
        <p className='mt-2 text-xs text-slate-400'>{ui.version} {GEKTA_LEGAL_VERSION}</p>
      </div>
    </footer>
  );
}
