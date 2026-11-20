import Link from 'next/link';
import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';

export const ABOUT_LABELS = {
  ru: { title: 'О Гекте', documents: 'Документы и условия', back: 'К диалогу', description: 'Возможности Гекты для хозяйства, ответы на частые вопросы и условия использования.' },
  en: { title: 'About Gekta', documents: 'Documents and terms', back: 'Back to chat', description: 'How Gekta helps on the farm, frequently asked questions and terms of use.' },
  zh: { title: '关于 Gekta', documents: '文件与条款', back: '返回对话', description: '了解 Gekta 如何协助农场运营，查看常见问题和使用条款。' },
} as const;

export function GektaHomeLinks({ locale }: { locale: GektaLocale }) {
  const labels = ABOUT_LABELS[locale];
  const path = GEKTA_PATHS[locale] + '/about';
  return (
    <nav aria-label={labels.title} data-gekta-server-discovery='true' className='mx-auto flex flex-wrap justify-center gap-x-5 px-4 pb-3 text-sm text-slate-600'>
      <Link href={path} className='inline-flex min-h-11 items-center underline underline-offset-4'>{labels.title}</Link>
      <Link href={path + '#documents'} className='inline-flex min-h-11 items-center underline underline-offset-4'>{labels.documents}</Link>
    </nav>
  );
}
