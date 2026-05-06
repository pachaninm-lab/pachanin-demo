import { GrainWorkflowPage } from '../../../../components/platform-v7/GrainWorkflowPage';

export default function SellerReputationPage() {
  return <GrainWorkflowPage eyebrow='Продавец · надёжность покупателей' title='Надёжность покупателей' lead='Продавец видит не декоративную оценку, а рабочий риск: история оплаты, документы, споры, дисциплина и влияние на условия сделки.' primaryHref='/platform-v7/trust' primaryLabel='Контур доверия' items={[
    { title: 'Рейтинг покупателя', value: '91/100', href: '/platform-v7/trust', tone: 'good', note: 'Влияет на приоритет и условия оплаты.' },
    { title: 'Проверка', value: 'стандартная', href: '/platform-v7/compliance/grain', tone: 'good', note: 'Полномочия, документы и допуск.' },
    { title: 'История', value: 'без критических событий', href: '/platform-v7/reports/grain', tone: 'good', note: 'Сделки, отзывы и дисциплина.' },
    { title: 'Условия', value: 'резерв обязателен', href: '/platform-v7/bank/grain', tone: 'warn', note: 'Рейтинг влияет на расчёт и контроль денег.' },
  ]} />;
}
