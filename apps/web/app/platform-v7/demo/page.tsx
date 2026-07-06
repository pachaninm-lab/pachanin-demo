import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Контур сделки — Прозрачная Цена',
  description: 'Рабочая карта исполнения зерновой сделки: цена, рейс, приёмка, качество, документы, расчёт, спор и доказательства.',
  alternates: { canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/deal-flow' },
};

export default function RetiredDemoRoute() {
  redirect('/platform-v7/deal-flow');
}
