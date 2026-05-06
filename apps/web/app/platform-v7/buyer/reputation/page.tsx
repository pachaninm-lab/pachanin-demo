import { GrainWorkflowPage } from '../../../../components/platform-v7/GrainWorkflowPage';

export default function BuyerReputationPage() {
  return <GrainWorkflowPage eyebrow='Покупатель · надёжность продавцов' title='Надёжность продавцов' lead='Покупатель видит рабочую оценку продавца: точность партии, качество, вес, отгрузка, документы, СДИЗ, история и отзывы.' primaryHref='/platform-v7/trust' primaryLabel='Контур доверия' items={[
    { title: 'Рейтинг продавца', value: '92/100', href: '/platform-v7/trust', tone: 'good', note: 'Влияет на подбор и условия сделки.' },
    { title: 'Качество', value: 'история точности', href: '/platform-v7/deals/grain-quality', tone: 'good', note: 'Сравнение заявленного и фактического качества.' },
    { title: 'Вес', value: 'контроль расхождений', href: '/platform-v7/deals/grain-weight', tone: 'warn', note: 'История отклонений влияет на риск.' },
    { title: 'Документы', value: 'дисциплина', href: '/platform-v7/documents/grain', tone: 'warn', note: 'Скорость и полнота документов.' },
  ]} />;
}
