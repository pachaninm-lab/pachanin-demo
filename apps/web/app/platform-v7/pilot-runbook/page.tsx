import Link from 'next/link';
import type { ReactNode } from 'react';
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

const pilotRoles = [
  ['Продавец', 'КФХ «Северное поле»', 'оформить СДИЗ, подписать документы, видеть выплату и удержания'],
  ['Покупатель', 'Покупатель 1', 'резерв, приёмка, погашение СДИЗ, спор по расхождению'],
  ['Перевозчик', 'ТК «Южные маршруты»', 'заявка, машины, ЭТрН, передача в ГИС ЭПД'],
  ['Водитель', 'Водитель А', 'один рейс, ETA, фото, пломба, прибытие'],
  ['Элеватор', 'Элеватор ВРЖ-08', 'вес, проба, акт приёмки и акт расхождения'],
  ['Лаборатория', 'Лаборатория пилота', 'структурированный протокол и влияние на цену'],
  ['Банк', 'ручной банковый контур', 'основание, удержание, partial release, reconciliation'],
  ['Оператор', 'поддержка пилота', 'SLA, блокеры, ручные подтверждения, журнал'],
] as const;

const manualConfirmations = [
  ['ФГИС статус вручную', 'партия и СДИЗ отмечаются как ручная проверка; автоматического подтверждения ФГИС нет'],
  ['ЭДО статус вручную', 'договор, УПД и акты проходят тестовый контур или ручную отметку'],
  ['ГИС ЭПД статус вручную', 'пакет ЭТрН проверяется по оператору ИС ЭПД; внешний доступ требует договора'],
  ['Bank callback вручную', 'банк подтверждает основание вручную или через будущий callback; платформа не перемещает деньги'],
  ['Лабораторный протокол вручную', 'лаборатория вносит структурированные показатели и КЭП-статус пилота'],
] as const;

const successCriteria = [
  'сделка закрыта без обхода платформы',
  'деньги не переходят в готовность без документов, СДИЗ, ЭПД, приёмки, качества и банкового основания',
  'спор связан с evidence pack и суммой удержания/выпуска',
  'каждая роль выполнила своё действие и получила следующую задачу',
  'audit trail объясняет кто, когда, что изменил и на каком основании',
  'ручной труд измерен и виден оператору',
] as const;

const failureCriteria = [
  'роль не понимает следующее действие',
  'суммы не сходятся с формулой',
  'документ не связан с выплатой или удержанием',
  'спор не связан с evidence pack',
  'водитель видит деньги, банк или лишние роли',
  'нет журнала действия или невозможно объяснить банку основание',
] as const;

const operatorChecklist = [
  'проверить единый объект DL-9106 во всех ролях',
  'убедиться, что DL-9102 не содержит LOT/TRIP/DL-9106',
  'провести СДИЗ по lifecycle: партия, оформление, подпись, передача, погашение или отказ',
  'провести ЭТрН: титулы, подписи, оператор ИС ЭПД, ГИС ЭПД статус',
  'зафиксировать вес, протокол качества, money impact и возможный спор',
  'передать решение арбитра в банковое основание как ручную проверку',
  'закрыть SLA поддержки и сохранить audit trail',
] as const;

export default function PlatformV7PilotRunbookPage() {
  const executionCase = selectDealExecutionCase('DL-9106');
  const summary = PLATFORM_V7_EXECUTION_SOURCE;
  const sdizLifecycle = selectDealSdizLifecycle('DL-9106');
  const transportPack = selectDealTransportDocumentPack('DL-9106');
  const documents = selectDealDocumentMatrix('DL-9106');
  const blockingDocuments = selectBlockingDealDocuments('DL-9106');

  if (!executionCase) {
    return <div style={page}>Сделка пилота не найдена.</div>;
  }

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <div style={micro}>controlled pilot runbook</div>
          <h1 style={h1}>Провести пилот DL-9106</h1>
          <p style={lead}>
            Одна зерновая сделка проходит путь от партии и лота до документов, спора, банкового основания и архива. Внешние контуры отмечены как ручная проверка, тестовый контур или ожидание внешнего подтверждения.
          </p>
        </div>
        <div style={heroMeta}>
          <Cell label='Лот' value={executionCase.lotId} />
          <Cell label='Объём' value={formatTons(executionCase.commodity.volumeDeclaredTons)} />
          <Cell label='Резерв' value={formatRub(executionCase.money.reserveAmount)} />
          <Cell label='К выпуску' value={formatRub(executionCase.money.readyToReleaseAmount)} />
        </div>
      </section>

      <section style={grid2}>
        <Panel title='Состав пилота' eyebrow='роли'>
          <div style={list}>
            {pilotRoles.map(([role, actor, task]) => (
              <Row key={role} label={role} value={actor} note={task} />
            ))}
          </div>
        </Panel>

        <Panel title='Сделка пилота' eyebrow='source of truth'>
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

      <Panel title='Чеклист оператора' eyebrow='провести пилот'>
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
const hero = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, alignItems: 'stretch', background: '#FFFFFF', border: '1px solid #E4E6EA', borderRadius: 20, padding: 20 } as const;
const heroMeta = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 } as const;
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 } as const;
const panel = { background: '#FFFFFF', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 } as const;
const list = { display: 'grid', gap: 8 } as const;
const checklistGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 8 } as const;
const checkItem = { display: 'grid', gridTemplateColumns: '32px 1fr', alignItems: 'start', gap: 10, border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#F8FAFB', color: '#0F1419', fontSize: 13, lineHeight: 1.45, fontWeight: 800 } as const;
const checkRow = { border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#F8FAFB', color: '#0F1419', fontSize: 13, lineHeight: 1.45, fontWeight: 800 } as const;
const row = { display: 'grid', gridTemplateColumns: 'minmax(140px,0.7fr) minmax(160px,1fr)', gap: 10, alignItems: 'center', border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#F8FAFB' } as const;
const cell = { border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#F8FAFB' } as const;
const micro = { color: '#0A7A5F', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const h1 = { margin: '6px 0 0', color: '#0F1419', fontSize: 34, lineHeight: 1.05, fontWeight: 950 } as const;
const h2 = { margin: 0, color: '#0F1419', fontSize: 20, lineHeight: 1.15, fontWeight: 950 } as const;
const lead = { margin: '10px 0 0', color: '#475569', fontSize: 14, lineHeight: 1.6, maxWidth: 820 } as const;
const rowLabel = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const rowValue = { marginTop: 4, color: '#0F1419', fontSize: 14, lineHeight: 1.35, fontWeight: 900 } as const;
const rowNote = { color: '#475569', fontSize: 12, lineHeight: 1.45 } as const;
const step = { display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 999, background: 'rgba(10,122,95,0.1)', color: '#0A7A5F', fontWeight: 950 } as const;
const button = { textDecoration: 'none', border: '1px solid #D7DEE8', borderRadius: 12, padding: '10px 14px', background: '#FFFFFF', color: '#0F1419', fontSize: 13, fontWeight: 900 } as const;
