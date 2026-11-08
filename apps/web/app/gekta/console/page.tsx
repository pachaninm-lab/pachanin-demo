import type { Metadata } from 'next';
import { GektaOwnerConsole } from '@/components/gekta/GektaOwnerConsole';

/**
 * Кабинет владельца Гекты.
 *
 * Служебная страница: она не входит в публичную карту сайта и не должна
 * попадать в поиск. Права проверяет сервер — страница сама ничего не решает.
 */
export const metadata: Metadata = {
  title: 'Кабинет Гекты',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default function GektaConsolePage() {
  return <GektaOwnerConsole />;
}
