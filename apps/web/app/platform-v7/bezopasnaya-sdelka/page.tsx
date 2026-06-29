import type { Metadata } from 'next';
import { PublicSeoLanding } from '@/components/platform-v7/PublicSeoLanding';

export const metadata: Metadata = {
  title: 'Безопасная зерновая сделка',
  description: 'Как платформа показывает исполнение зерновой сделки: рейс, приёмка, качество, документы, спор и основание для расчёта.',
  alternates: { canonical: '/platform-v7/bezopasnaya-sdelka' },
};

export default function SafeDealPage() {
  return <PublicSeoLanding kicker='Безопасная сделка' title='Сделка контролируется событиями, а не обещаниями' description='Платформа показывает, что подтверждено по рейсу, приёмке, качеству и документам, а также что мешает закрытию сделки.' blocks={[{ title: 'Единый контур', text: 'Цена, рейс, приёмка, документы и спорный слой связаны с одним объектом сделки.' }, { title: 'Доказательность', text: 'Факты, документы и действия участников собираются в проверяемую цепочку.' }, { title: 'Граница обещаний', text: 'Публичный контур не заявляет неподтверждённые внешние подключения и подходит для controlled pilot.' }]} />;
}
