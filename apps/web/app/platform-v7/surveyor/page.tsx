import { NextActionCard, StatusChip, Surface } from '@pc/design-system-v8';
import { FieldTaskTemplate, KeyFact, KeyFactGrid } from '@/components/transaction-ux/FieldTaskTemplate';
import workspace from '@/components/transaction-ux/FieldRoleWorkspace.module.css';
import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { BatonStrip } from '@/components/platform-v7/BatonStrip';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';

type SurveyorAssignment = {
  id: string;
  deal: string;
  cargo: string;
  location: string;
  time: string;
  status: 'Требует акта' | 'Ожидает';
};

const surveyorSteps = [
  { label: 'Осмотр', value: 'фото и состояние', note: 'что видно на площадке без пересказа сторон' },
  { label: 'Расхождение', value: 'причина и место', note: 'где возникло отклонение и чем подтверждается' },
  { label: 'Замечание', value: 'текст и вложения', note: 'кратко, с привязкой к рейсу и партии' },
  { label: 'Заключение', value: 'независимая фиксация', note: 'основание уходит в доказательный контур' },
] as const;

const assignments: SurveyorAssignment[] = [
  { id: 'QC-DL-9102', deal: 'DL-9102', cargo: 'Пшеница 4 кл.', location: 'Элеватор Тамбов', time: '11:00', status: 'Требует акта' },
  { id: 'QC-DL-9108', deal: 'DL-9108', cargo: 'Ячмень 3 кл.', location: 'Склад Курск', time: '14:30', status: 'Ожидает' },
];

export default function Page() {
  const urgent = assignments.filter((assignment) => assignment.status === 'Требует акта');

  const primary = (
    <div className={workspace.stack}>
      <NextActionCard
        label='Одно следующее действие'
        action='Оформить независимый акт по QC-DL-9102'
        reason='Зафиксировать состояние груза, место расхождения, фото и краткое заключение. Решение по деньгам и спору остаётся за уполномоченными ролями.'
        blocked
        impact='без акта доказательный контур неполон'
        owner='назначенный сюрвейер'
        deadline='осмотр назначен на 11:00'
        actions={(
          <>
            <a className={workspace.primaryLink} href='/platform-v7/surveyor/acts/QC-DL-9102'>Открыть акт</a>
            <a className={workspace.secondaryLink} href='#surveyor-assignments'>Все назначения</a>
          </>
        )}
      />

      <KeyFactGrid>
        <KeyFact label='Назначений' value={assignments.length} hint='на текущую смену' />
        <KeyFact label='Срочно' value={urgent.length} hint='требует независимого акта' />
        <KeyFact label='Объект' value='рейс и партия' hint='без финансовых данных' />
        <KeyFact label='Результат' value='акт + фото' hint='передаётся оператору' />
      </KeyFactGrid>

      <CollapsibleSection title='Передача между ролями' summary='логистика → осмотр → оператор' defaultOpen>
        <BatonStrip
          from='логистика — рейс и груз'
          mine='осмотр, фото, расхождение, акт'
          to='оператор — доказательный контур'
          toHref='/platform-v7/disputes'
        />
      </CollapsibleSection>

      <section id='surveyor-assignments' className={workspace.sectionAnchor}>
        <CollapsibleSection title='Назначения на осмотр' summary='акты · площадка · время' defaultOpen>
          <Surface>
            <div className={workspace.assignmentList}>
              {assignments.map((assignment) => (
                <a
                  key={assignment.id}
                  href={`/platform-v7/surveyor/acts/${assignment.id}`}
                  className={workspace.assignmentCard}
                >
                  <span className={workspace.assignmentCopy}>
                    <strong>{assignment.id} · {assignment.cargo}</strong>
                    <span>{assignment.location} · {assignment.deal}</span>
                    <small>{assignment.time}</small>
                  </span>
                  <StatusChip tone={assignment.status === 'Требует акта' ? 'warning' : 'neutral'}>
                    {assignment.status}
                  </StatusChip>
                </a>
              ))}
            </div>
          </Surface>
        </CollapsibleSection>
      </section>
    </div>
  );

  const context = (
    <ol className={workspace.contextList}>
      {surveyorSteps.map((item) => (
        <li key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.note}</small>
        </li>
      ))}
    </ol>
  );

  const evidence = (
    <CollapsibleSection title='Роль сюрвейера' summary='что видит и что отдаёт' defaultOpen={false}>
      <RoleExecutionSummary role='surveyor' />
    </CollapsibleSection>
  );

  return (
    <FieldTaskTemplate
      testId='platform-v7-surveyor-page'
      eyebrow='Сюрвейер · независимая фиксация'
      title='Осмотр, фото, расхождение и заключение'
      description='Сюрвейер видит только назначенный объект, факты осмотра и доказательства. Банк, деньги и решение спора вне этой роли.'
      statusLabel={`${assignments.length} назначения`}
      statusTone={urgent.length ? 'warning' : 'success'}
      primary={primary}
      context={context}
      evidence={evidence}
    />
  );
}
