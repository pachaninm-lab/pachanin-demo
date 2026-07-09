import Link from 'next/link';
import type { ReactNode } from 'react';
import { CockpitHero } from '@/components/platform-v7/premium';
import {
  PLATFORM_V7_EXECUTION_SOURCE,
  formatRub,
  formatTons,
  selectBlockingDealDocuments,
  selectDealDocumentMatrix,
  selectDealExecutionCase,
  selectDealSdizLifecycle,
  selectDealTransportDocumentPack,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

const executionRoles = [
  ['Продавец', 'КФХ «Северное поле»', 'оформить СДИЗ, подписать документы, видеть расчёт и удержания'],
  ['Покупатель', 'Покупатель 1', 'резерв, приёмка, погашение СДИЗ, спор по расхождению'],
  ['Перевозчик', 'ТК «Южные маршруты»', 'заявка, машины, ЭТрН, передача статуса перевозки'],
  ['Водитель', 'Водитель А', 'один рейс, ETA, фото, пломба, прибытие'],
  ['Элеватор', 'Элеватор ВРЖ-08', 'вес, проба, акт приёмки и акт расхождения'],
  ['Лаборатория', 'Лаборатория качества', 'структурированный протокол и влияние на цену'],
  ['Банк', 'банковское основание', 'основание, удержание, partial release, reconciliation после подключения банка'],
  ['Оператор', 'операционный контроль', 'SLA, блокеры, ручные подтверждения, журнал'],
] as const;

const manualConfirmations = [
  ['ФГИС статус', 'партия и СДИЗ отмечаются как ручная проверка; автоматического подтверждения ФГИС нет'],
  ['ЭДО статус', 'договор, УПД и акты проходят ручную отметку до подключения внешнего провайдера'],
  ['ГИС ЭПД статус', 'пакет ЭТрН проверяется оператором; внешний доступ требует договора'],
  ['Bank callback', 'банк подтверждает основание вручную или через будущий callback; платформа не перемещает деньги'],
  ['Лабораторный протокол', 'лаборатория вносит структурированные показатели и статус подписи'],
] as const;

const successCriteria = [
  'сделка закрыта без обхода платформы',
  'деньги не переходят в готовность без документов, СДИЗ, ЭПД, приёмки, качества и банкового основания',
  'спор связан с evidence pack и суммой удержания или release-основания',
  'каждая роль выполнила своё действие и получила следующую задачу',
  'журнал объясняет кто, когда, что изменил и на каком основании',
  'ручной труд измерен и виден оператору',
] as const;

const failureCriteria = [
  'роль не понимает следующее действие',
  'суммы не сходятся с формулой',
  'документ не связан с расчётом или удержанием',
  'спор не связан с evidence pack',
  'водитель видит деньги, банк или лишние роли',
  'нет журнала действия или невозможно объяснить банку основание',
] as const;

const operatorChecklist = [
  'проверить единый объект DL-9106 во всех ролях',
  'убедиться, что связанные лот, рейс, документы и расчёт не расходятся между ролями',
  'провести СДИЗ по lifecycle: партия, оформление, подпись, передача, погашение или отказ',
  'провести ЭТрН: титулы, подписи, оператор ИС ЭПД, статус передачи',
  'зафиксировать вес, протокол качества, money impact и возможный спор',
  'передать решение арбитра в банковое основание как ручную проверку',
  'закрыть SLA поддержки и сохранить журнал действий',
] as const;

export default function PlatformV7PilotRunbookPage() {
  const executionCase = selectDealExecutionCase('DL-9106');
  const summary = PLATFORM_V7_EXECUTION_SOURCE;
  const sdizLifecycle = selectDealSdizLifecycle('DL-9106');
  const transportPack = selectDealTransportDocumentPack('DL-9106');
  const documents = selectDealDocumentMatrix('DL-9106');
  const blockingDocuments = selectBlockingDealDocuments('DL-9106');

  if (!executionCase) {
    return <div style={page}>Сделка не найдена.</div>;
  }

  return (
    <main style={page}>
      <CockpitHero
        eyebrow='execution runbook'
        title='Провести сделку DL-9106'
        lead='Одна зерновая сделка проходит путь от партии и лота до документов, спора, банкового основания и архива. Внешние контуры временно не подключены и отмечены как ручная проверка или ожидание внешнего подтверждения.'
      >
        <div style={heroMeta}>
          <Cell label='Лот' value={executionCase.lotId} />
          <Cell label='Объём' value={formatTons(executionCase.commodity.volumeDeclaredTons)} />
          <Cell label='Резерв' value={formatRub(executionCase.money.reserveAmount)} />
          <Cell label='К release-основанию' value={formatRub(executionCase.money.readyToReleaseAmount)} />
        </div>
      </CockpitHero>

      <section style={grid2}>
        <Panel title='Состав исполнения' eyebrow='роли'>
          <div style={list}>
            {executionRoles.map(([role, actor, task]) => (
              <Row key={role} label={role} value={actor} note={task} />
            ))}
          </div>
        </Panel>

        <Panel title='Сделка' eyebrow='source of truth'>
          <div style={list}>
            <Row label='Культура' value={`${executionCase.commodity.crop} · ${executionCase.commodity.class}`} note={`урожай ${executionCase.commodity.harvestYear}`} />
            <Row label='Цена' value={`${formatRub(executionCase.price.pricePerTon)} / т`} note={executionCase.price.calculationFormula} />
            <Row label='Регион' value={executionCase.commodity.originRegion} note={executionCase.commodity.storageLocation} />
            <Row label='Логистика' value={summary.logistics.orderId} note={`${summary.logistics.tripId} · ${summary.logistics.currentLeg}`} />
            <Row label='Банк' value={executionCase.money.bankStatus} note={executionCase.money.reconciliationStatus} />
          </div>
        </Panel>
      </section>

      <section style={grid2}>
        <Panel title='Ручные подтверждения' eyebrow='внешние контуры'>
          <div style={list}>
            {manualConfirmations.map(([label, note]) => (
              <Row key={label} label={label} value='ручная проверка' note={note} />
            ))}
          </div>
        </Panel>

        <Panel title='Документы и gates' eyebrow='матрица'>
          <div style={list}>
            <Row label='Всего документов' value={String(documents.length)} note='договор, УПД, СДИЗ, ЭТрН, ГИС ЭПД, КЭП/МЧД, акты, качество, банк, спор, ПДн, правила платформы' />
            <Row label='Блокируют деньги' value={String(blockingDocuments.length)} note={blockingDocuments.slice(0, 4).map((item) => item.title).join(', ')} />
            <Row label='СДИЗ lifecycle' value={`${sdizLifecycle.length} шагов`} note={sdizLifecycle.map((step) => step.title).join(' → ')} />
            <Row label='ЭПД пакет' value={transportPack?.etrnId ?? 'нет'} note={`${transportPack?.epdOperator ?? 'оператор не выбран'} · ${transportPack?.gisEpdTransferStatus ?? 'нет статуса'}`} />
          </div>
        </Panel>
      </section>

      <section style={grid2}>
        <Checklist title='Что считать успехом' items={successCriteria} tone='good' />
        <Checklist title='Что считать провалом' items={failureCriteria} tone='bad' />
      </section>

      <Panel title='Чеклист оператора' eyebrow='исполнение сделки'>
        <div style={checklistGrid}>
          {operatorChecklist.map((item, index) => (
            <div key={item} style={checkItem}>
              <span style={step}>{index + 1}</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/control-tower' style={button}>Центр управления</Link>
        <Link href='/platform-v7/buyer' style={button}>Кабинет покупателя</Link>
        <Link href='/platform-v7/bank' style={button}>Банк</Link>
      </div>
    </main>
  );
}

function Panel({ title, eyebrow, children }: { readonly title: string; readonly eyebrow: string; readonly children: ReactNode }) {
  return (
    <section style={panel}>
      <div style={micro}>{eyebrow}</div>
      <h2 style={h2}>{title}</h2>
      {children}
    </section>
  );
}

function Checklist({ title, items, tone }: { readonly title: string; readonly items: readonly string[]; readonly tone: 'good' | 'bad' }) {
  return (
    <Panel title={title} eyebrow={tone === 'good' ? 'success' : 'failure'}>
      <div style={list}>
        {items.map((item) => (
          <div key={item} style={{ ...checkRow, borderColor: tone === 'good' ? 'rgba(10,122,95,0.18)' : 'rgba(185,28,28,0.18)' }}>
            {item}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Row({ label, value, note }: { readonly label: string; readonly value: string; readonly note: string }) {
  return (
    <div style={row}>
      <div style={{ minWidth: 0 }}>
        <div style={rowLabel}>{label}</div>
        <div style={rowValue}>{value}</div>
      </div>
      <div style={rowNote}>{note}</div>
    </div>
  );
}

function Cell({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div style={cell}>
      <div style={rowLabel}>{label}</div>
      <div style={rowValue}>{value}</div>
    </div>
  );
}

const page = { display: 'grid', gap: 18, padding: '8px 0 24px' } as const;
const heroMeta = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 } as const;
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 } as const;
const panel = { background: '#FFFFFF', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 16, display: 'grid', gap: 12 } as const;
const list = { display: 'grid', gap: 8 } as const;
const checklistGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 8 } as const;
const checkItem = { display: 'grid', gridTemplateColumns: '32px 1fr', alignItems: 'start', gap: 10, border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 12, padding: 12, background: '#F8FAFB', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, lineHeight: 1.45, fontWeight: 800 } as const;
const checkRow = { border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 12, padding: 12, background: '#F8FAFB', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, lineHeight: 1.45, fontWeight: 800 } as const;
const row = { display: 'grid', gridTemplateColumns: 'minmax(140px,0.7fr) minmax(160px,1fr)', gap: 10, alignItems: 'start', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 12, padding: 12, background: '#F8FAFB' } as const;
const cell = { display: 'grid', gap: 4, border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 12, padding: 12, background: '#F8FAFB' } as const;
const rowLabel = { color: 'var(--pc-text-muted, #66758A)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const rowValue = { color: 'var(--pc-text-primary, #0F1419)', fontSize: 14, fontWeight: 900, overflowWrap: 'anywhere' } as const;
const rowNote = { color: 'var(--pc-text-secondary, #52616B)', fontSize: 12, lineHeight: 1.45, fontWeight: 700, overflowWrap: 'anywhere' } as const;
const micro = { color: 'var(--pc-text-muted, #66758A)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' } as const;
const h2 = { margin: 0, fontSize: 18, lineHeight: 1.15, fontWeight: 950, letterSpacing: '-0.02em', color: 'var(--pc-text-primary, #0F1419)' } as const;
const step = { width: 26, height: 26, borderRadius: 9, display: 'inline-grid', placeItems: 'center', background: 'rgba(10,122,95,0.10)', color: '#087A3B', fontSize: 12, fontWeight: 950 } as const;
const button = { minHeight: 42, borderRadius: 12, padding: '0 14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#fff', background: '#087A3B', fontSize: 13, fontWeight: 900 } as const;
