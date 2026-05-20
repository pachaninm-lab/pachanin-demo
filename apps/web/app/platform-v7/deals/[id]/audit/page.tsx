import { GrainWorkflowPage } from '../../../../../components/platform-v7/GrainWorkflowPage';
import { WorkflowActionPanel } from '../../../../../components/platform-v7/WorkflowActionPanel';
import { TimelineWithImpact } from '@/components/platform-v7/visual/TimelineWithImpact';

export default function DealAuditPage({ params }: { params: { id: string } }) {
  const dealId = params.id;

  return (
    <>
      <TimelineWithImpact
        events={[
          { id: 'ev-1', text: 'Партия создана продавцом',                       impact: 'открыт путь к сделке',               actor: 'Продавец',   ts: '09:14',  tone: 'ok'      },
          { id: 'ev-2', text: 'Оффер сохранён, условия зафиксированы',           impact: 'условия переданы покупателю',         actor: 'Оператор',   ts: '09:21',  tone: 'ok'      },
          { id: 'ev-3', text: 'Резерв средств подтверждён',                      impact: 'деньги зарезервированы',             actor: 'Банк',       ts: '10:05',  tone: 'money'   },
          { id: 'ev-4', text: `Рейс ${dealId === 'DL-9106' ? 'ВРЖ-08' : 'ТМБ-14'} отправлен`,                         impact: 'груз в пути',                        actor: 'Водитель',   ts: '11:30',  tone: 'neutral' },
          { id: 'ev-5', text: 'СДИЗ не закрыт — основание не сформировано',      impact: 'банковская проверка остановлена',     actor: 'Оператор',   ts: '13:00',  tone: 'blocked' },
          { id: 'ev-6', text: 'Документ открыт на просмотр',                     impact: 'просмотр зафиксирован в журнале',    actor: 'Оператор',   ts: '13:15',  tone: 'neutral' },
          { id: 'ev-7', text: 'Сигнал риска проверен',                           impact: 'проверка завершена без изменений',   actor: 'Оператор',   ts: '14:00',  tone: 'warn'    },
        ]}
        maxItems={5}
      />
      <GrainWorkflowPage eyebrow='Сделка · журнал' title={`Журнал сделки ${dealId}`} lead='Журнал показывает действия, роли, объекты, причины, изменения статуса и материалы, на которые опирается сделка.' primaryHref='/platform-v7/data-room/grain' primaryLabel='Data-room' items={[
        { title: 'Партия', value: 'создана', href: '/platform-v7/seller/batches', tone: 'good', note: 'Событие создания партии связано с продавцом.' },
        { title: 'Оффер', value: 'версия сохранена', href: '/platform-v7/offer-log', tone: 'good', note: 'Изменение условий создаёт новую запись.' },
        { title: 'Документ', value: 'открыт', href: '/platform-v7/documents/grain', tone: 'warn', note: 'Просмотр и скачивание фиксируются.' },
        { title: 'Риск', value: 'проверен', href: '/platform-v7/security/grain', tone: 'warn', note: 'Сигналы риска связаны с объектом сделки.' },
      ]} />
      <WorkflowActionPanel context='deal' />
    </>
  );
}
