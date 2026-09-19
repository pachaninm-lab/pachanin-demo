'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useToast } from '@/components/v7r/Toast';
import { ConfirmDialog } from '@/components/v7r/ConfirmDialog';
import { RiskBadge } from '@/components/v7r/RiskBadge';

interface DealDetail {
  id: string;
  cargo: string;
  weight: number;
  seller: string;
  buyer: string;
  status: string;
  risk: number;
  reserve: number;
  hold: number;
  release: number;
  pricePerTon: number;
  total: number;
  contract: { number: string; signed: string; gost: string; moistureMax: number; proteinMin: number; glutenMin: number };
  logistics: { routeId: string; plate: string; driver: string; from: string; to: string; km: number; eta: string; seal: string; sealOk: boolean };
  reception: { surveyorAct: string; surveyorOk: boolean; labProtocol: string; labOk: boolean; labIssue?: string; weightLoaded: number; weightUnloaded: number; weightDelta: number };
  documents: Array<{ name: string; signed: boolean; issue: boolean }>;
}

const DEALS: Record<string, DealDetail> = {
  'DL-9102': {
    id: 'DL-9102', cargo: 'Пшеница 4 кл.', weight: 200.3, seller: 'Агро-Юг ООО', buyer: 'Агрохолдинг СК',
    status: 'Спор по качеству', risk: 92, reserve: 6200000, hold: 624000, release: 4368000,
    pricePerTon: 14800, total: 2964440,
    contract: { number: 'ДГ-2024-9102', signed: '12.04.2026', gost: 'ГОСТ 9353-2016', moistureMax: 14, proteinMin: 10, glutenMin: 23 },
    logistics: { routeId: 'ТМБ-14', plate: 'А777ВВ136', driver: 'Иванов И.И.', from: 'Тамбов', to: 'Краснодар · Элеватор', km: 340, eta: '14:30', seal: '4481-В', sealOk: true },
    reception: { surveyorAct: 'ВЗФ-2024-044', surveyorOk: true, labProtocol: 'ЛАБ-2847', labOk: false, labIssue: 'Влажность 15.2% (допуск ≤14%)', weightLoaded: 201.5, weightUnloaded: 200.3, weightDelta: -1.2 },
    documents: [
      { name: 'Контракт ДГ-2024-9102.pdf', signed: true, issue: false },
      { name: 'Товарная накладная.pdf', signed: true, issue: false },
      { name: 'СДИЗ №ЗЗ-2024-009102 (ФГИС)', signed: true, issue: false },
      { name: 'Лаб. протокол ЛАБ-2847.pdf', signed: true, issue: true },
      { name: 'Акт сюрвейера ВЗФ-2024-044.pdf', signed: true, issue: false },
    ],
  },
  'DL-9103': {
    id: 'DL-9103', cargo: 'Кукуруза 3 кл.', weight: 150, seller: 'КФХ Петров', buyer: 'ЗАО МелькомбинатЮг',
    status: 'В пути', risk: 22, reserve: 3150000, hold: 0, release: 2800000,
    pricePerTon: 15600, total: 2340000,
    contract: { number: 'ДГ-2024-9103', signed: '10.04.2026', gost: 'ГОСТ 13634-90', moistureMax: 14, proteinMin: 8, glutenMin: 0 },
    logistics: { routeId: 'ВРЖ-08', plate: 'В123КК52', driver: 'Сидоров П.В.', from: 'Воронеж', to: 'Тамбов · Элеватор', km: 280, eta: '16:00', seal: '5512-К', sealOk: true },
    reception: { surveyorAct: 'ВЗФ-2024-039', surveyorOk: true, labProtocol: 'ЛАБ-2838', labOk: true, weightLoaded: 150.2, weightUnloaded: 150.0, weightDelta: -0.2 },
    documents: [
      { name: 'Контракт ДГ-2024-9103.pdf', signed: true, issue: false },
      { name: 'Товарная накладная.pdf', signed: true, issue: false },
      { name: 'СДИЗ №ЗЗ-2024-009103 (ФГИС)', signed: true, issue: false },
    ],
  },
  'DL-9109': {
    id: 'DL-9109', cargo: 'Пшеница 4 кл.', weight: 350, seller: 'КФХ Мирный', buyer: 'ЗерноТрейд ООО',
    status: 'Запрошена выплата', risk: 12, reserve: 10500000, hold: 0, release: 9800000,
    pricePerTon: 14800, total: 5180000,
    contract: { number: 'ДГ-2024-9109', signed: '05.04.2026', gost: 'ГОСТ 9353-2016', moistureMax: 14, proteinMin: 10, glutenMin: 23 },
    logistics: { routeId: 'КРС-12', plate: 'Е888ОО36', driver: 'Козлов М.А.', from: 'Курск', to: 'Белгород · Элеватор', km: 120, eta: 'Доставлено', seal: '7790-Е', sealOk: true },
    reception: { surveyorAct: 'ВЗФ-2024-040', surveyorOk: true, labProtocol: 'ЛАБ-2840', labOk: true, weightLoaded: 351.0, weightUnloaded: 350.0, weightDelta: -1.0 },
    documents: [
      { name: 'Контракт ДГ-2024-9109.pdf', signed: true, issue: false },
      { name: 'Товарная накладная.pdf', signed: true, issue: false },
      { name: 'СДИЗ №ЗЗ-2024-009109 (ФГИС)', signed: true, issue: false },
      { name: 'Лаб. протокол ЛАБ-2840.pdf', signed: true, issue: false },
      { name: 'Акт сюрвейера ВЗФ-2024-040.pdf', signed: true, issue: false },
    ],
  },
};

const TABS = ['Контракт', 'Логистика', 'Приёмка', 'Документы', 'Расчёт'] as const;
type Tab = typeof TABS[number];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #F1F3F5' }}>
      <span style={{ fontSize: 12, color: '#6B778C', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function StatusRow({ label, id, ok, issue }: { label: string; id: string; ok: boolean; issue?: string }) {
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #F1F3F5' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#6B778C', fontWeight: 600 }}>{label}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#0A7A5F' }}>{id}</span>
          <span style={{ fontSize: 16 }}>{ok ? '✅' : '❌'}</span>
        </div>
      </div>
      {issue && <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600, marginTop: 6 }}>⚠️ {issue}</div>}
    </div>
  );
}

export default function DealDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const toast = useToast();
  const [activeTab, setActiveTab] = React.useState<Tab>('Контракт');
  const [confirm, setConfirm] = React.useState<{ open: boolean; title: string; desc: string; onConfirm: () => void }>({ open: false, title: '', desc: '', onConfirm: () => {} });

  const deal = id ? DEALS[id] : null;

  if (!deal) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419', marginBottom: 8 }}>Сделка не найдена</div>
        <div style={{ fontSize: 13, color: '#6B778C', marginBottom: 16 }}>Сделка {id} не существует в демо-контуре</div>
        <Link href="/platform-v7/deals" style={{ padding: '10px 18px', borderRadius: 12, background: '#0A7A5F', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>← Все сделки</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 900, margin: '0 auto' }}>
      <ConfirmDialog {...confirm} danger onCancel={() => setConfirm(c => ({ ...c, open: false }))} />

      {/* Шапка */}
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 800, color: '#0A7A5F' }}>{deal.id}</div>
            <div style={{ fontSize: 14, color: '#374151', marginTop: 4 }}>{deal.cargo} · {deal.weight} т · {deal.seller} → {deal.buyer}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: deal.risk >= 61 ? '#FEF2F2' : '#FFFBEB', color: deal.risk >= 61 ? '#DC2626' : '#D97706', border: `1px solid ${deal.risk >= 61 ? '#FECACA' : '#FDE68A'}` }}>{deal.status}</span>
            <RiskBadge score={deal.risk} />
            <Link href="/platform-v7/deals" style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#F5F7F8', color: '#0F1419', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>← Список</Link>
          </div>
        </div>

        {/* Фазы */}
        <div style={{ display: 'flex', gap: 0, alignItems: 'center', marginTop: 8 }}>
          {[
            { label: 'Контракт', done: true },
            { label: 'Логистика', done: deal.risk < 90, active: deal.risk < 90 && deal.status === 'В пути' },
            { label: 'Приёмка', done: deal.reception.surveyorOk, active: !deal.reception.labOk },
            { label: 'Расчёт', done: deal.status === 'Запрошена выплата', active: deal.status === 'Запрошена выплата' },
          ].map((step, i) => (
            <React.Fragment key={step.label}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: step.done ? '#0A7A5F' : step.active ? '#D97706' : '#E4E6EA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: step.done || step.active ? '#fff' : '#9CA3AF', fontSize: 11, fontWeight: 800 }}>
                  {step.done && !step.active ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: step.done ? '#0A7A5F' : step.active ? '#D97706' : '#9CA3AF', marginTop: 4, textAlign: 'center' }}>{step.label}</div>
              </div>
              {i < 3 && <div style={{ flex: 0, width: 20, height: 2, background: step.done ? '#0A7A5F' : '#E4E6EA', marginBottom: 18 }} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Вкладки */}
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #E4E6EA', overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: '0 0 auto',
                padding: '14px 20px',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab ? '#0A7A5F' : 'transparent'}`,
                background: 'transparent',
                fontSize: 13,
                fontWeight: activeTab === tab ? 800 : 600,
                color: activeTab === tab ? '#0A7A5F' : '#6B778C',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}>
              {tab}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {activeTab === 'Контракт' && (
            <div>
              <Row label="Номер контракта" value={deal.contract.number} />
              <Row label="Продавец" value={deal.seller} />
              <Row label="Покупатель" value={deal.buyer} />
              <Row label="Культура" value={`${deal.cargo} · ${deal.weight} т`} />
              <Row label="Цена" value={`${deal.pricePerTon.toLocaleString('ru')} ₽/т`} />
              <Row label="Сумма" value={`${deal.total.toLocaleString('ru')} ₽`} />
              <Row label="ГОСТ" value={deal.contract.gost} />
              <Row label="Влажность" value={`≤${deal.contract.moistureMax}%`} />
              <Row label="Протеин" value={`≥${deal.contract.proteinMin}%`} />
              {deal.contract.glutenMin > 0 && <Row label="Клейковина" value={`≥${deal.contract.glutenMin}%`} />}
              <Row label="Подписан" value={deal.contract.signed} />
              <div style={{ marginTop: 14 }}>
                <span style={{ padding: '4px 10px', borderRadius: 999, background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', fontSize: 11, fontWeight: 800 }}>КЭП ✅ Контракт подписан электронной подписью</span>
              </div>
            </div>
          )}

          {activeTab === 'Логистика' && (
            <div>
              {/* Степпер маршрута */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, overflowX: 'auto' }}>
                {[
                  { label: 'Погрузка', done: true },
                  { label: 'В пути', done: deal.status !== 'В пути', active: deal.status === 'В пути' },
                  { label: 'Прибытие', done: deal.reception.surveyorOk },
                  { label: 'Разгрузка', done: deal.reception.labOk },
                ].map((step, i) => (
                  <React.Fragment key={step.label}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: step.done ? '#0A7A5F' : step.active ? '#0B6B9A' : '#E4E6EA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: step.done || step.active ? '#fff' : '#9CA3AF', fontSize: 12, fontWeight: 800 }}>
                        {step.done ? '✓' : i + 1}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: step.done ? '#0A7A5F' : step.active ? '#0B6B9A' : '#9CA3AF', marginTop: 4, textAlign: 'center' }}>{step.label}</div>
                    </div>
                    {i < 3 && <div style={{ flex: 1, height: 2, background: step.done ? '#0A7A5F' : '#E4E6EA', marginBottom: 18, minWidth: 20 }} />}
                  </React.Fragment>
                ))}
              </div>
              <Row label="Рейс" value={deal.logistics.routeId} />
              <Row label="ТС" value={deal.logistics.plate} />
              <Row label="Водитель" value={deal.logistics.driver} />
              <Row label="Маршрут" value={`${deal.logistics.from} → ${deal.logistics.to} (${deal.logistics.km} км)`} />
              <Row label="ETA" value={deal.logistics.eta} />
              <Row label="Пломба" value={`${deal.logistics.seal} ${deal.logistics.sealOk ? '✅' : '❌'}`} />
            </div>
          )}

          {activeTab === 'Приёмка' && (
            <div>
              <StatusRow label="Акт сюрвейера" id={deal.reception.surveyorAct} ok={deal.reception.surveyorOk} />
              <StatusRow label="Лаб. протокол" id={deal.reception.labProtocol} ok={deal.reception.labOk} issue={deal.reception.labIssue} />
              <div style={{ height: 12 }} />
              <Row label="Вес при погрузке" value={`${deal.reception.weightLoaded} т`} />
              <Row label="Вес при разгрузке" value={`${deal.reception.weightUnloaded} т`} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0' }}>
                <span style={{ fontSize: 12, color: '#6B778C', fontWeight: 600 }}>Расхождение</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: Math.abs(deal.reception.weightDelta) > 1 ? '#D97706' : '#0F1419' }}>
                  {deal.reception.weightDelta} т {Math.abs(deal.reception.weightDelta) > 1 ? '⚠️' : '✅'}
                </span>
              </div>
              {deal.reception.labIssue && (
                <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13, fontWeight: 600 }}>
                  ❌ {deal.reception.labIssue}
                </div>
              )}
            </div>
          )}

          {activeTab === 'Документы' && (
            <div style={{ display: 'grid', gap: 10 }}>
              {deal.documents.map(doc => (
                <div key={doc.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F1F3F5' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0F1419' }}>{doc.issue ? '⚠️' : '📄'} {doc.name}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {doc.signed && <span style={{ padding: '2px 8px', borderRadius: 999, background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', fontSize: 11, fontWeight: 800 }}>КЭП ✅</span>}
                    {doc.issue && <span style={{ padding: '2px 8px', borderRadius: 999, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontSize: 11, fontWeight: 800 }}>Расхождение</span>}
                    <button onClick={() => toast(`Скачивание: ${doc.name}`, 'info')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E4E6EA', background: '#F5F7F8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Скачать</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'Расчёт' && (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                <tbody>
                  <tr><td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5', fontSize: 13 }}>Стоимость партии</td><td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{deal.total.toLocaleString('ru')} ₽</td></tr>
                  <tr><td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5', fontSize: 13 }}>Зарезервировано</td><td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5', textAlign: 'right', fontWeight: 700, color: '#0A7A5F', fontSize: 13 }}>{deal.reserve.toLocaleString('ru')} ₽</td></tr>
                  <tr><td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5', fontSize: 13 }}>Под удержанием</td><td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5', textAlign: 'right', fontWeight: 700, color: deal.hold > 0 ? '#DC2626' : '#6B778C', fontSize: 13 }}>− {deal.hold.toLocaleString('ru')} ₽</td></tr>
                  <tr><td style={{ padding: '10px 0', fontSize: 14, fontWeight: 800 }}>К выплате продавцу</td><td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 800, color: '#15803D', fontSize: 14 }}>{deal.release.toLocaleString('ru')} ₽</td></tr>
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setConfirm({ open: true, title: 'Открыть спор?', desc: `Будет создан спор по сделке ${deal.id}. Сумма ${deal.hold.toLocaleString('ru')} ₽ останется заморожена.`, onConfirm: () => { setConfirm(c => ({ ...c, open: false })); toast(`Спор по ${deal.id} открыт`, 'warning'); } })}
                  style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ⚠️ Открыть спор
                </button>
                <button
                  onClick={() => toast('Запрос на частичный выпуск отправлен в банк', 'info')}
                  style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(217,119,6,0.2)', background: 'rgba(217,119,6,0.06)', color: '#D97706', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ⚡ Частичный выпуск
                </button>
                <button
                  onClick={() => toast('Эскалация отправлена в банк', 'warning')}
                  style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F5F7F8', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  📤 Эскалировать в банк
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
