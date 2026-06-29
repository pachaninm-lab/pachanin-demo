import type { Metadata } from 'next';
import { PublicSeoLanding } from '@/components/platform-v7/PublicSeoLanding';

export const metadata: Metadata = {
  title: 'Покупателям зерна',
  description: 'Страница для покупателей зерна: поставка, приёмка, качество, документы и пилот платформы.',
  alternates: { canonical: '/platform-v7/pokupatelyam' },
};

export default function BuyersPage() {
  return <PublicSeoLanding kicker='Для покупателей' title='Контроль поставки зерна после согласования условий' description='Покупатель видит статус исполнения: рейс, приёмку, качество, документы, расхождения и готовность основания для расчёта.' blocks={[{ title: 'Прозрачность поставки', text: 'События сделки собраны в одном процессе и связаны с ответственными участниками.' }, { title: 'Качество и документы', text: 'Показатели качества и комплект документов видны до закрытия сделки.' }, { title: 'Пилотный запуск', text: 'Демо показывает сценарий без регистрации. Рабочий доступ включается отдельно.' }]} />;
}
