import type { Metadata } from 'next';
import { PublicSeoLanding } from '@/components/platform-v7/PublicSeoLanding';

export const metadata: Metadata = {
  title: 'ФГИС Зерно, СДИЗ и документы сделки',
  description: 'Публичная страница о документном контуре зерновой сделки: СДИЗ, ЭДО, транспортные документы, приёмка и доказательная база.',
  alternates: { canonical: '/platform-v7/fgis-zerno-i-dokumenty' },
};

export default function DocumentsPage() {
  return <PublicSeoLanding kicker='Документы и прослеживаемость' title='Документы должны быть связаны с фактическим исполнением сделки' description='СДИЗ, ЭДО, транспортные документы, приёмка и качество должны работать как единый проверяемый контур, а не как разрозненные файлы.' blocks={[{ title: 'Документный след', text: 'Платформа показывает комплектность документов и связь документов с этапами исполнения.' }, { title: 'Снижение споров', text: 'Когда документ связан с событием сделки, проще понять причину расхождения и ответственного участника.' }, { title: 'Пилотная граница', text: 'Интеграции с внешними системами требуют отдельного подключения и проверки в controlled pilot.' }]} />;
}
