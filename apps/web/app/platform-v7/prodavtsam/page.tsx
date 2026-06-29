import type { Metadata } from 'next';
import { PublicSeoLanding } from '@/components/platform-v7/PublicSeoLanding';

export const metadata: Metadata = {
  title: 'Продавцам зерна',
  description: 'Страница для продавцов зерна: рейс, приёмка, качество, документы и пилот платформы.',
  alternates: { canonical: '/platform-v7/prodavtsam' },
};

export default function SellersPage() {
  return <PublicSeoLanding kicker='Для продавцов' title='Контроль исполнения зерновой сделки' description='Публичная страница о том, как продавец видит этапы сделки после согласования условий.' blocks={[{ title: 'Контроль партии', text: 'Рейс, приёмка, качество и документы собраны в одном процессе.' }, { title: 'Снижение спорности', text: 'Каждый этап показывает статус, ответственного и следующий шаг.' }, { title: 'Пилот', text: 'Демо доступно без регистрации. Рабочий доступ включается отдельно.' }]} />;
}
