import { GrainWorkflowPage } from '../../../../components/platform-v7/GrainWorkflowPage';

export default function CounterpartyPage({ params }: { params: { counterpartyId: string } }) {
  return <GrainWorkflowPage eyebrow='Контрагент' title={`Карточка контрагента ${params.counterpartyId}`} lead='Карточка показывает рейтинг, риск, историю исполнения, документы, отзывы, ограничения доступа и влияние на допуск к сделке.' primaryHref='/platform-v7/trust' primaryLabel='Контур доверия' items={[
    { title: 'Рейтинг', value: 'рассчитан', href: '/platform-v7/trust', tone: 'good', note: 'Итоговый балл влияет на подбор и условия.' },
    { title: 'Риск-факторы', value: 'проверяются', href: '/platform-v7/compliance/grain', tone: 'warn', note: 'Внешние и внутренние факторы требуют нейтральной формулировки.' },
    { title: 'История сделок', value: 'связана', href: '/platform-v7/reports/grain', tone: 'good', note: 'Учитываются документы, качество, вес и дисциплина.' },
    { title: 'Ограничения', value: 'по роли', href: '/platform-v7/control-tower/bypass-risk', tone: 'warn', note: 'Доступ зависит от стадии и уровня риска.' },
  ]} />;
}
