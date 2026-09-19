'use client';

import { useState } from 'react';

export interface SupplierRating {
  orgId: string;
  name: string;
  inn: string;
  region: string;
  rating: number; // 1-5
  dealCount: number;
  avgDeliveryDays: number;
  qualityScore: number; // 0-100
  riskScore: number; // 0-100
  isFavorite: boolean;
  lastDealDate: string;
  cultures: string[];
}

const DEMO_SUPPLIERS: SupplierRating[] = [
  { orgId: 'org-6164065090', name: 'ООО «АгроТрейд Юг»', inn: '6164065090', region: 'Краснодарский край', rating: 4.8, dealCount: 47, avgDeliveryDays: 3.2, qualityScore: 94, riskScore: 18, isFavorite: true, lastDealDate: '2024-03-01', cultures: ['Пшеница 3кл', 'Ячмень 2кл'] },
  { orgId: 'org-2309160154', name: 'ИП Ковалёв С.А.', inn: '2309160154', region: 'Ростовская область', rating: 4.2, dealCount: 12, avgDeliveryDays: 4.8, qualityScore: 78, riskScore: 42, isFavorite: true, lastDealDate: '2024-02-15', cultures: ['Кукуруза', 'Подсолнечник'] },
  { orgId: 'org-7743013901', name: 'ЗАО «Зернопродукт-Черноземье»', inn: '7743013901', region: 'Воронежская область', rating: 4.6, dealCount: 31, avgDeliveryDays: 2.9, qualityScore: 88, riskScore: 22, isFavorite: false, lastDealDate: '2024-01-20', cultures: ['Пшеница 4кл', 'Рапс'] },
  { orgId: 'org-5048020099', name: 'ООО «СтепьАгро»', inn: '5048020099', region: 'Тамбовская область', rating: 3.9, dealCount: 8, avgDeliveryDays: 6.1, qualityScore: 71, riskScore: 58, isFavorite: false, lastDealDate: '2023-11-10', cultures: ['Соя', 'Пшеница 4кл'] },
];

export interface FavoriteLot {
  lotId: string;
  culture: string;
  volumeTons: number;
  priceRubPerTon: number;
  supplierName: string;
  region: string;
  savedAt: string;
  status: 'available' | 'reserved' | 'closed';
}

const DEMO_FAVORITE_LOTS: FavoriteLot[] = [
  { lotId: 'LOT-2405', culture: 'Пшеница 4кл', volumeTons: 240, priceRubPerTon: 16120, supplierName: 'ООО «АгроТрейд Юг»', region: 'Краснодарский край', savedAt: '2024-03-10', status: 'available' },
  { lotId: 'LOT-2403', culture: 'Пшеница 4кл', volumeTons: 600, priceRubPerTon: 16080, supplierName: 'ИП Ковалёв С.А.', region: 'Ростовская область', savedAt: '2024-03-08', status: 'reserved' },
  { lotId: 'LOT-2398', culture: 'Ячмень 2кл', volumeTons: 180, priceRubPerTon: 13450, supplierName: 'ЗАО «Зернопродукт-Черноземье»', region: 'Воронежская область', savedAt: '2024-03-05', status: 'available' },
];

function StarRating({ value }: { value: number }) {
  return (
    <span style={{ color: '#F59E0B', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
      {'★'.repeat(Math.floor(value))}{'☆'.repeat(5 - Math.floor(value))} {value.toFixed(1)}
    </span>
  );
}

function RiskBar({ score }: { score: number }) {
  const color = score < 30 ? 'var(--risk-low-text, #059669)' : score < 60 ? 'var(--risk-medium-text, #D97706)' : 'var(--risk-critical-text, #DC2626)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--p7-color-border, #24342F)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: '2px' }} />
      </div>
      <span style={{ fontSize: '10px', color, fontWeight: 700, flexShrink: 0 }}>{score}</span>
    </div>
  );
}

export function BuyerFavoritesPanel() {
  const [activeTab, setActiveTab] = useState<'lots' | 'suppliers'>('lots');
  const [suppliers, setSuppliers] = useState(DEMO_SUPPLIERS);
  const [lots, setLots] = useState(DEMO_FAVORITE_LOTS);
  const [sortBy, setSortBy] = useState<'rating' | 'risk' | 'deals'>('rating');

  const favorites = suppliers.filter((s) => s.isFavorite);
  const sortedSuppliers = [...suppliers].sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'risk') return a.riskScore - b.riskScore;
    return b.dealCount - a.dealCount;
  });

  function toggleFavorite(orgId: string) {
    setSuppliers((prev) => prev.map((s) => s.orgId === orgId ? { ...s, isFavorite: !s.isFavorite } : s));
  }

  function removeLot(lotId: string) {
    setLots((prev) => prev.filter((l) => l.lotId !== lotId));
  }

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '0.375rem 0.875rem',
    borderRadius: '6px',
    border: 'none',
    background: active ? 'var(--p7-color-brand, #0A7A5F)' : 'transparent',
    color: active ? '#fff' : 'var(--pc-text-muted)',
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '36px',
  });

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--p7-color-surface-muted)', borderRadius: '8px', padding: '0.25rem' }}>
        <button style={TAB_STYLE(activeTab === 'lots')} onClick={() => setActiveTab('lots')}>
          Избранные лоты ({lots.length})
        </button>
        <button style={TAB_STYLE(activeTab === 'suppliers')} onClick={() => setActiveTab('suppliers')}>
          Поставщики ({suppliers.length})
        </button>
      </div>

      {activeTab === 'lots' && (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {lots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--pc-text-muted)', fontSize: 'var(--text-sm)' }}>
              Нет избранных лотов
            </div>
          ) : lots.map((lot) => {
            const totalRub = lot.priceRubPerTon * lot.volumeTons;
            const statusColor = lot.status === 'available' ? 'var(--status-active-text)' : lot.status === 'reserved' ? 'var(--status-pending-text)' : 'var(--pc-text-muted)';
            const statusLabel = lot.status === 'available' ? 'Доступен' : lot.status === 'reserved' ? 'Зарезервирован' : 'Закрыт';

            return (
              <div key={lot.lotId} style={{
                padding: '0.75rem',
                borderRadius: '10px',
                background: 'var(--p7-color-surface-muted)',
                border: '1px solid var(--p7-color-border)',
                display: 'grid',
                gap: '0.5rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--p7-color-brand)', fontWeight: 700 }}>{lot.lotId}</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--pc-text-primary)', marginTop: '0.25rem' }}>
                      {lot.culture} · {lot.volumeTons} т
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)' }}>
                      {lot.supplierName} · {lot.region}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>
                      {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(lot.priceRubPerTon)}/т
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>
                      {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(totalRub)} итого
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <a
                    href={`/platform-v7/lots/${lot.lotId}`}
                    style={{
                      flex: 1, textAlign: 'center', padding: '0.375rem',
                      borderRadius: '6px', textDecoration: 'none', fontSize: 'var(--text-xs)',
                      fontWeight: 700, color: '#fff', background: 'var(--p7-color-brand)',
                      minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    Открыть лот
                  </a>
                  <button
                    onClick={() => removeLot(lot.lotId)}
                    title="Убрать из избранного"
                    style={{
                      padding: '0.375rem 0.625rem', borderRadius: '6px',
                      border: '1px solid var(--p7-color-border)', background: 'transparent',
                      color: 'var(--pc-text-muted)', fontSize: 'var(--text-xs)',
                      cursor: 'pointer', minHeight: '36px',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {/* Sort */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)', fontWeight: 600 }}>СОРТИРОВКА</span>
            {(['rating', 'risk', 'deals'] as const).map((s) => (
              <button key={s} onClick={() => setSortBy(s)} style={{
                padding: '0.25rem 0.625rem', borderRadius: '5px',
                border: `1px solid ${sortBy === s ? 'var(--p7-color-brand)' : 'var(--p7-color-border)'}`,
                background: sortBy === s ? 'rgba(10,122,95,0.1)' : 'transparent',
                color: sortBy === s ? 'var(--p7-color-brand)' : 'var(--pc-text-muted)',
                fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              }}>
                {s === 'rating' ? 'Рейтинг' : s === 'risk' ? 'Риск' : 'Сделки'}
              </button>
            ))}
          </div>

          {sortedSuppliers.map((sup) => (
            <div key={sup.orgId} style={{
              padding: '0.75rem',
              borderRadius: '10px',
              background: sup.isFavorite ? 'rgba(10,122,95,0.05)' : 'var(--p7-color-surface-muted)',
              border: `1px solid ${sup.isFavorite ? 'rgba(10,122,95,0.25)' : 'var(--p7-color-border)'}`,
              display: 'grid',
              gap: '0.5rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>{sup.name}</span>
                    {sup.isFavorite && <span style={{ fontSize: '10px', color: 'var(--p7-color-brand)', fontWeight: 700 }}>★ избранный</span>}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', marginTop: '2px' }}>
                    ИНН {sup.inn} · {sup.region}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', marginTop: '2px' }}>
                    {sup.cultures.join(', ')}
                  </div>
                </div>
                <button
                  onClick={() => toggleFavorite(sup.orgId)}
                  title={sup.isFavorite ? 'Убрать из избранного' : 'В избранное'}
                  style={{
                    padding: '0.25rem 0.5rem', borderRadius: '6px', flexShrink: 0,
                    border: `1px solid ${sup.isFavorite ? 'var(--p7-color-brand)' : 'var(--p7-color-border)'}`,
                    background: 'transparent',
                    color: sup.isFavorite ? 'var(--p7-color-brand)' : 'var(--pc-text-muted)',
                    fontSize: '1rem', cursor: 'pointer', lineHeight: 1,
                  }}
                >
                  {sup.isFavorite ? '★' : '☆'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.375rem' }}>
                <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>
                  Рейтинг<br /><StarRating value={sup.rating} />
                </div>
                <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>
                  Сделок<br /><span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>{sup.dealCount}</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>
                  Доставка<br /><span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>{sup.avgDeliveryDays} дн.</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>
                  Качество<br /><span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: sup.qualityScore >= 80 ? 'var(--status-active-text)' : 'var(--status-warning-text)' }}>{sup.qualityScore}%</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', marginBottom: '0.25rem' }}>Риск-скор</div>
                <RiskBar score={sup.riskScore} />
              </div>

              <a
                href={`/platform-v7/counterparty/${sup.inn}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0.375rem', borderRadius: '6px',
                  textDecoration: 'none', fontSize: 'var(--text-xs)',
                  fontWeight: 700, color: 'var(--p7-color-brand)',
                  border: '1px solid rgba(10,122,95,0.3)',
                  background: 'rgba(10,122,95,0.05)',
                  minHeight: '36px',
                }}
              >
                Профиль контрагента →
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {activeTab === 'suppliers' && favorites.length > 0 && (
        <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', padding: '0.5rem 0', borderTop: '1px solid var(--p7-color-border)' }}>
          {favorites.length} поставщиков в избранном · среднее время доставки {(favorites.reduce((a, s) => a + s.avgDeliveryDays, 0) / favorites.length).toFixed(1)} дн.
        </div>
      )}
    </div>
  );
}
