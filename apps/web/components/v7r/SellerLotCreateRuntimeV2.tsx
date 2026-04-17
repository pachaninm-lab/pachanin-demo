'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCommercialRuntimeStore } from '@/stores/useCommercialRuntimeStore';
import { useToast } from '@/components/v7r/Toast';

function palette(tone: 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (tone === 'warning') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  if (tone === 'danger') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  return { bg: '#F8FAFB', border: '#E4E6EA', color: '#475569' };
}

function Badge({ tone, children }: { tone: 'success' | 'warning' | 'danger' | 'neutral'; children: React.ReactNode }) {
  const p = palette(tone);
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, color: p.color, fontSize: 11, fontWeight: 800 }}>{children}</span>;
}

export function SellerLotCreateRuntimeV2() {
  const router = useRouter();
  const toast = useToast();
  const { addManualLot } = useCommercialRuntimeStore();
  const [grain, setGrain] = React.useState('Пшеница 4 кл.');
  const [volumeTons, setVolumeTons] = React.useState('240');
  const [region, setRegion] = React.useState('Тамбов');
  const [docsReady, setDocsReady] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const previewState = docsReady ? 'PASS' : 'REVIEW';
  const previewTone = docsReady ? 'success' : 'warning';
  const nextStep = docsReady ? 'Можно публиковать лот и переходить к переговорам.' : 'Нужно дозагрузить обязательные документы продавца.';

  function handleSubmit() {
    const numericVolume = Number(volumeTons);
    if (!grain.trim()) return toast('Укажи культуру.', 'error');
    if (!region.trim()) return toast('Укажи регион.', 'error');
    if (!Number.isFinite(numericVolume) || numericVolume <= 0) return toast('Укажи корректный объём в тоннах.', 'error');

    setSaving(true);
    const created = addManualLot({ grain: grain.trim(), volumeTons: numericVolume, region: region.trim(), docsReady });
    toast(`Лот ${created.id} создан и сохранён в локальном контуре.`, 'success');
    router.push('/platform-v7/lots');
  }

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>Создание manual-лота</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 920 }}>Экран перестроен в mobile-safe single-flow layout: форма и preview идут вертикально и больше не наслаиваются на телефоне.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/lots' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Все лоты</Link>
            <Badge tone='neutral'>Мобильная версия</Badge>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 16 }}>
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Параметры лота</div>
            <div style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>Минимальный честный контур для продавца: культура, объём, регион и готовность пакета документов.</div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: '#6B778C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Культура</label>
              <input value={grain} onChange={(event) => setGrain(event.target.value)} placeholder='Пшеница 4 кл.' style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', fontSize: 14 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#6B778C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Объём, тонн</label>
                <input value={volumeTons} onChange={(event) => setVolumeTons(event.target.value)} inputMode='decimal' placeholder='240' style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6B778C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Регион</label>
                <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder='Тамбов' style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', fontSize: 14 }} />
              </div>
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA', cursor: 'pointer' }}>
              <input type='checkbox' checked={docsReady} onChange={(event) => setDocsReady(event.target.checked)} style={{ marginTop: 2 }} />
              <span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0F1419' }}>Обязательный пакет документов уже готов</span>
                <span style={{ display: 'block', fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 4 }}>Если галочка снята, лот всё равно сохраняется, но получает state REVIEW и понятный документный blocker.</span>
              </span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleSubmit} disabled={saving} style={{ borderRadius: 12, padding: '12px 16px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 14, fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Сохраняем…' : 'Сохранить manual-лот'}</button>
            <Link href='/platform-v7/lots' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '12px 16px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 14, fontWeight: 700 }}>Отмена</Link>
          </div>
        </section>

        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Предпросмотр readiness</div>
            <div style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>Логика gate считается до сохранения, чтобы пользователь видел правду заранее.</div>
          </div>
          <div style={{ padding: 16, borderRadius: 16, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>NEW MANUAL LOT</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{grain || '—'} / {region || '—'}</div>
            <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{volumeTons || '0'} т · MANUAL</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge tone='neutral'>MANUAL</Badge>
            <Badge tone={previewTone}>{previewState}</Badge>
          </div>
          <div style={{ padding: 14, borderRadius: 14, background: docsReady ? 'rgba(10,122,95,0.06)' : 'rgba(217,119,6,0.08)', border: docsReady ? '1px solid rgba(10,122,95,0.14)' : '1px solid rgba(217,119,6,0.16)' }}>
            <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{nextStep}</div>
          </div>
          {!docsReady ? (
            <div style={{ padding: 14, borderRadius: 14, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.16)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>Документный blocker</div>
                <Badge tone='warning'>DOCS_MISSING</Badge>
              </div>
              <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 8 }}>Лот сохранится, но будет честно помечен как REVIEW до загрузки обязательного пакета документов.</div>
            </div>
          ) : (
            <div style={{ padding: 14, borderRadius: 14, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.14)', fontSize: 13, fontWeight: 700, color: '#0A7A5F' }}>Блокеров нет. После сохранения лот будет готов к следующему шагу внутри платформы.</div>
          )}
        </section>
      </section>
    </div>
  );
}
