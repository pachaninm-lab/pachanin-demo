'use client';

import { selectRuntimeDeals } from '@/lib/domain/selectors';
import { createPlatformV7MetadataSlot } from '@/lib/platform-v7/metadata-slots';

type DocumentStatus = 'ready' | 'missing' | 'review' | 'notRequired';

type DocumentRow = {
  key: string;
  name: string;
  status: DocumentStatus;
  owner: string;
  blocks: string;
  moneyImpact: boolean;
  nextStep: string;
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  ready: 'Готово',
  missing: 'Не хватает',
  review: 'На проверке',
  notRequired: 'Не требуется',
};

function statusTone(status: DocumentStatus) {
  if (status === 'ready') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (status === 'missing') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  if (status === 'review') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: '#F8FAFB', border: '#E4E6EA', color: '#64748B' };
}

function metadataTone(status: string) {
  if (status === 'available') return { bg: 'rgba(10,122,95,0.08)', color: '#0A7A5F' };
  if (status === 'partial') return { bg: 'rgba(217,119,6,0.08)', color: '#B45309' };
  return { bg: 'rgba(100,116,139,0.08)', color: '#64748B' };
}

function hasBlocker(dealBlockers: readonly string[], pattern: string) {
  return dealBlockers.some((blocker) => blocker.toLowerCase().includes(pattern));
}

function buildDocumentRows(deal: ReturnType<typeof selectRuntimeDeals>[number]): DocumentRow[] {
  const docsBlocked = hasBlocker(deal.blockers, 'docs');
  const bankBlocked = hasBlocker(deal.blockers, 'bank');
  const qualityPending = ['quality_check', 'quality_disputed'].includes(deal.status);
  const routeStarted = Boolean(deal.route?.length || deal.routeId || deal.routeState);
  const routeClosed = ['arrived', 'unloading_started', 'unloading_done', 'quality_check', 'quality_approved', 'quality_disputed', 'docs_complete', 'release_requested', 'release_approved', 'closed'].includes(deal.status);
  const docsComplete = ['docs_complete', 'release_requested', 'release_approved', 'closed'].includes(deal.status);

  return [
    {
      key: 'sdiz',
      name: 'СДИЗ',
      status: docsComplete ? 'ready' : docsBlocked ? 'missing' : 'review',
      owner: 'Продавец / оператор',
      blocks: 'Выпуск денег и закрытие сделки',
      moneyImpact: true,
      nextStep: docsComplete ? 'Документ принят' : 'Проверить или загрузить СДИЗ',
    },
    {
      key: 'edo',
      name: 'ЭДО',
      status: docsComplete ? 'ready' : docsBlocked ? 'missing' : 'review',
      owner: 'Стороны сделки',
      blocks: 'Подписи и банковскую проверку',
      moneyImpact: true,
      nextStep: docsComplete ? 'Пакет закрыт' : 'Дособрать подписи',
    },
    {
      key: 'etrn',
      name: 'ЭТрН',
      status: routeClosed ? 'ready' : routeStarted ? 'review' : 'missing',
      owner: 'Логистика / водитель',
      blocks: 'Транспортное основание',
      moneyImpact: true,
      nextStep: routeClosed ? 'Рейс закрыт' : 'Закрыть рейс и транспортный пакет',
    },
    {
      key: 'lab',
      name: 'Лабораторный протокол',
      status: qualityPending ? 'review' : ['quality_approved', 'docs_complete', 'release_requested', 'release_approved', 'closed'].includes(deal.status) ? 'ready' : 'missing',
      owner: 'Лаборатория',
      blocks: 'Качество и спор',
      moneyImpact: true,
      nextStep: qualityPending ? 'Загрузить или подтвердить протокол' : 'Проверить качество',
    },
    {
      key: 'acceptance',
      name: 'Акт приёмки',
      status: routeClosed ? 'ready' : 'missing',
      owner: 'Элеватор / покупатель',
      blocks: 'Закрытие приёмки',
      moneyImpact: true,
      nextStep: routeClosed ? 'Приёмка зафиксирована' : 'Подтвердить вес и приёмку',
    },
    {
      key: 'bank',
      name: 'Основание для банка',
      status: bankBlocked ? 'review' : docsComplete ? 'ready' : 'missing',
      owner: 'Банк / оператор',
      blocks: 'Подтверждение выпуска денег',
      moneyImpact: true,
      nextStep: bankBlocked ? 'Дождаться ручной проверки' : docsComplete ? 'Открыть проверку выпуска' : 'Дособрать документы',
    },
  ];
}

export function DocumentsMatrix() {
  const deals = selectRuntimeDeals();
  const primaryDeal = deals.find((deal) => deal.blockers.length > 0 || deal.holdAmount > 0 || deal.status === 'quality_disputed') ?? deals[0];
  const rows = primaryDeal ? buildDocumentRows(primaryDeal) : [];
  const missingCount = rows.filter((row) => row.status === 'missing').length;
  const reviewCount = rows.filter((row) => row.status === 'review').length;
  const metadata = [
    createPlatformV7MetadataSlot({ key: 'source', label: 'Источник', value: primaryDeal?.sourceOfTruth ? String(primaryDeal.sourceOfTruth) : null, source: 'текущие данные' }),
    createPlatformV7MetadataSlot({ key: 'version', label: 'Версия сделки', value: primaryDeal ? String(primaryDeal.version) : null, source: 'журнал версий' }),
    createPlatformV7MetadataSlot({ key: 'signature', label: 'Подпись', source: 'ЭДО' }),
    createPlatformV7MetadataSlot({ key: 'externalConfirmation', label: 'Внешнее подтверждение', source: 'внешняя система' }),
  ];

  return (
    <section data-testid="platform-v7-documents-matrix" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>DocumentsMatrix · документный контур</div>
          <div style={{ marginTop: 4, fontSize: 22, lineHeight: 1.12, fontWeight: 950, color: '#0F1419' }}>
            {primaryDeal ? `${primaryDeal.id} · документы и деньги` : 'Документы'}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>
            Матрица показывает, чего не хватает, кто следующий и влияет ли документ на выпуск денег.
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 999, border: missingCount || reviewCount ? '1px solid rgba(217,119,6,0.18)' : '1px solid rgba(10,122,95,0.18)', background: missingCount || reviewCount ? 'rgba(217,119,6,0.08)' : 'rgba(10,122,95,0.08)', color: missingCount || reviewCount ? '#B45309' : '#0A7A5F', fontSize: 12, fontWeight: 900 }}>
          {missingCount || reviewCount ? `${missingCount} не хватает · ${reviewCount} на проверке` : 'Пакет закрыт'}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((row) => {
          const tone = statusTone(row.status);
          return (
            <div key={row.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 0.8fr) minmax(120px, 0.7fr) minmax(160px, 1fr) minmax(160px, 1fr)', gap: 10, alignItems: 'center', border: '1px solid #EEF1F4', borderRadius: 12, padding: 10, background: '#F8FAFB' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#0F1419' }}>{row.name}</div>
                <div style={{ marginTop: 3, fontSize: 11, color: '#64748B' }}>{row.owner}</div>
              </div>
              <span style={{ width: 'fit-content', display: 'inline-flex', alignItems: 'center', padding: '5px 8px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 900 }}>
                {STATUS_LABEL[row.status]}
              </span>
              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.45 }}>{row.blocks}</div>
              <div style={{ fontSize: 12, color: row.moneyImpact ? '#B45309' : '#64748B', lineHeight: 1.45, fontWeight: 750 }}>{row.nextStep}</div>
            </div>
          );
        })}
      </div>

      <div data-testid="platform-v7-document-metadata" style={{ borderTop: '1px solid #EEF1F4', paddingTop: 12, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#0F1419' }}>Метаданные документов</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {metadata.map((slot) => {
            const t = metadataTone(slot.status);
            return (
              <div key={slot.key} style={{ borderRadius: 12, padding: 10, background: t.bg, color: t.color }}>
                <div style={{ fontSize: 11, fontWeight: 900 }}>{slot.label}</div>
                <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.4 }}>{slot.value}</div>
                <div style={{ marginTop: 4, fontSize: 10, opacity: 0.78 }}>{slot.source}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
