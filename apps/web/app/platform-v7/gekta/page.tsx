import type { Metadata } from 'next';
import PublicGektaPage from '../ai-in-action/page';

export const metadata: Metadata = {
  title: 'Гекта — Прозрачная Цена',
  description: 'Гекта объясняет контекст Сделки, документы, логистику, качество, расчёт, риски и допустимый следующий шаг в пределах доступных фактов и полномочий.',
  alternates: { canonical: '/platform-v7/gekta' },
  robots: { index: true, follow: true },
};

export default PublicGektaPage;
