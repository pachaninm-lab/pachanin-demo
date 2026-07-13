import { getLocale } from 'next-intl/server';
import { StatusChip, Surface } from '@pc/design-system-v8';
import { CanonicalDealsList } from '@/components/platform-v7/CanonicalDealsList';
import styles from './deals.module.css';

type Locale = 'ru' | 'en' | 'zh';

const COPY: Record<Locale, { eyebrow: string; title: string; body: string }> = {
  ru: {
    eyebrow: 'Реестр исполнения',
    title: 'Сделки',
    body: 'Здесь показаны только сделки, к которым сервер подтвердил ваше участие. Статические сценарии, демонстрационные суммы и внутренние симуляторы в рабочий реестр не попадают.',
  },
  en: {
    eyebrow: 'Execution registry',
    title: 'Deals',
    body: 'Only deals for which the server has confirmed your participation are shown. Static scenarios, demonstration amounts and internal simulations are excluded from the working registry.',
  },
  zh: {
    eyebrow: '执行登记',
    title: '交易',
    body: '这里只显示服务器已确认你参与的交易。静态场景、演示金额和内部模拟不会进入工作登记。',
  },
};

function normalizeLocale(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export default async function PlatformV7DealsPage() {
  const locale = normalizeLocale(await getLocale());
  const copy = COPY[locale];

  return (
    <main className={styles.page} data-testid='platform-v7-deals-page' data-transaction-deals-registry='v8' data-locale={locale}>
      <Surface className={styles.pageHeader} aria-labelledby='deals-page-title'>
        <StatusChip tone='information'>{copy.eyebrow}</StatusChip>
        <h1 id='deals-page-title'>{copy.title}</h1>
        <p>{copy.body}</p>
      </Surface>
      <CanonicalDealsList />
    </main>
  );
}
