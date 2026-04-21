'use client';

import * as React from 'react';
import Link from 'next/link';

interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

const REQUIRED_DOCS = [
  { id: 'contract', label: 'Контракт купли-продажи', blocker: true },
  { id: 'lab', label: 'Лабораторный протокол', blocker: true },
  { id: 'surveyor', label: 'Акт сюрвейера / приёмки', blocker: true },
  { id: 'bank', label: 'Подтверждение резерва банка', blocker: true },
  { id: 'transport', label: 'Транспортный документ', blocker: false },
];

function storageKey(dealId: string) {
  return `pc-docs-${dealId}`;
}

function checklistKey(dealId: string) {
  return `pc-doc-checklist-${dealId}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusTone(ok: boolean) {
  return ok
    ? { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F', label: 'Готово' }
    : { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309', label: 'Ждём' };
}

export default function DealDocumentsPage({ params }: { params: { id: string } }) {
  const [docs, setDocs] = React.useState<UploadedDoc[]>([]);
  const [checklist, setChecklist] = React.useState<Record<string, boolean>>({});
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const rawDocs = window.localStorage.getItem(storageKey(params.id));
      const rawChecklist = window.localStorage.getItem(checklistKey(params.id));
      if (rawDocs) setDocs(JSON.parse(rawDocs));
      if (rawChecklist) setChecklist(JSON.parse(rawChecklist));
    } catch {}
  }, [params.id]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const blockerDone = REQUIRED_DOCS.filter((doc) => doc.blocker && checklist[doc.id]).length;
  const blockerTotal = REQUIRED_DOCS.filter((doc) => doc.blocker).length;
  const releaseReady = blockerDone === blockerTotal;
  const requiredDone = REQUIRED_DOCS.filter((doc) => checklist[doc.id]).length;

  const auditTrail = React.useMemo(() => {
    const checklistEvents = REQUIRED_DOCS.filter((doc) => checklist[doc.id]).map((doc, index) => ({
      id: `chk-${doc.id}`,
      ts: new Date(Date.now() - (index + 1) * 36 * 60 * 1000).toISOString(),
      actor: 'Оператор / документный контур',
      action: `Подтверждён документ: ${doc.label}`,
      note: doc.blocker ? 'Снимает blocker для выпуска денег.' : 'Не блокирует выпуск, но усиливает досье сделки.',
    }));
    const fileEvents = docs.map((doc) => ({
      id: `doc-${doc.id}`,
      ts: doc.uploadedAt,
      actor: 'Пользователь / upload',
      action: `Загружен файл: ${doc.name}`,
      note: `${formatSize(doc.size)} · ${doc.type || 'file'}`,
    }));
    return [...fileEvents, ...checklistEvents].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [docs, checklist]);

  function requestRelease() {
    setToast(releaseReady ? `Запрос на выпуск по ${params.id} подготовлен.` : `Нельзя запросить выпуск: ${blockerDone}/${blockerTotal} blocker-документов готовы.`);
  }

  function buildDossier() {
    setToast(`Досье сделки ${params.id} сформировано.`);
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 14 }}>{params.id}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', marginTop: 6 }}>Документы сделки</div>
            <div style={{ fontSize: 13, color: '#6B778C', marginTop: 6, lineHeight: 1.6 }}>Отдельный документный контур: файлы, checklist, audit trail и готовность к выпуску денег.</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: releaseReady ? 'rgba(10,122,95,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${releaseReady ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, color: releaseReady ? '#0A7A5F' : '#B45309', fontSize: 11, fontWeight: 800 }}>
            {releaseReady ? 'Документы готовы к выпуску' : `До выпуска: ${blockerDone}/${blockerTotal}`}
          </span>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <Metric title='Файлы' value={String(docs.length)} note='Загруженные документы в досье сделки.' />
        <Metric title='Checklist' value={`${requiredDone}/${REQUIRED_DOCS.length}`} note='Подтверждённые пункты документного набора.' />
        <Metric title='Blocker-docs' value={`${blockerDone}/${blockerTotal}`} note='Критичные документы, влияющие на выпуск денег.' />
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Готовность досье</div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>Что уже подтверждено и что ещё держит денежный контур.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={buildDossier} style={{ padding: '10px 14px', borderRadius: 12, background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Сформировать досье</button>
            <button onClick={requestRelease} style={{ padding: '10px 14px', borderRadius: 12, background: releaseReady ? '#0A7A5F' : '#F8FAFB', border: releaseReady ? '1px solid #0A7A5F' : '1px solid #E4E6EA', color: releaseReady ? '#fff' : '#6B778C', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
              Запросить выпуск
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {REQUIRED_DOCS.map((doc) => {
            const tone = statusTone(!!checklist[doc.id]);
            return (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: '1px solid #E4E6EA', background: checklist[doc.id] ? 'rgba(10,122,95,0.06)' : '#F8FAFB' }}>
                <span style={{ width: 18, textAlign: 'center', fontWeight: 900, color: checklist[doc.id] ? '#0A7A5F' : '#9AA4B2' }}>{checklist[doc.id] ? '✓' : '•'}</span>
                <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{doc.label}</div>
                  <div style={{ fontSize: 11, color: '#6B778C' }}>{doc.blocker ? 'Блокирует выпуск денег' : 'Не блокирует выпуск, но нужен для полного досье'}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 800 }}>
                  {tone.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(320px,.9fr)', gap: 16 }}>
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Реестр файлов</div>
          {docs.length ? docs.map((doc) => (
            <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff' }}>
              <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                <div style={{ fontSize: 11, color: '#6B778C' }}>{formatSize(doc.size)} · {new Date(doc.uploadedAt).toLocaleString('ru-RU')}</div>
              </div>
              <span style={{ fontSize: 11, color: '#6B778C', fontWeight: 700 }}>{doc.type || 'file'}</span>
            </div>
          )) : <div style={{ fontSize: 13, color: '#6B778C' }}>Файлы по сделке ещё не загружены.</div>}
        </section>

        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Audit trail</div>
          {auditTrail.length ? auditTrail.map((event) => (
            <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '12px 1fr', gap: 12, alignItems: 'start' }}>
              <div style={{ width: 12, height: 12, borderRadius: 999, background: '#0A7A5F', marginTop: 5 }} />
              <div style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{event.action}</div>
                  <div style={{ fontSize: 11, color: '#6B778C' }}>{new Date(event.ts).toLocaleString('ru-RU')}</div>
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{event.actor}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{event.note}</div>
              </div>
            </div>
          )) : <div style={{ fontSize: 13, color: '#6B778C' }}>История действий появится после загрузки файлов и подтверждения checklist.</div>}
        </section>
      </div>

      {toast ? (
        <div role='status' aria-live='polite' style={{ padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', borderRadius: 12, color: '#0A7A5F', fontSize: 12, fontWeight: 700 }}>
          {toast}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/platform-v7/deals/${params.id}`} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>← Вернуться в сделку</Link>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Все сделки</Link>
      </div>
    </div>
  );
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: '#0F1419' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>{note}</div>
    </section>
  );
}
