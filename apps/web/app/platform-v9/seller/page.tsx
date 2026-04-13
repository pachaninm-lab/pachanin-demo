'use client';
import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Upload, FileCheck, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { KpiCard } from '@/components/v9/cards/KpiCard';
import { useSessionStore } from '@/stores/useSessionStore';
import { toast } from 'sonner';

interface UploadedFile {
  name: string;
  size: number;
  uploadedAt: string;
  status: 'uploading' | 'done' | 'error';
  docType: string;
}

const requiredDocs = [
  { id: 'acceptance', label: 'Акт приёмки (форма А)', dealId: 'DL-9102', urgent: true },
  { id: 'ztt', label: 'Форма ЗТТ', dealId: 'DL-9102', urgent: true },
  { id: 'quality', label: 'Сертификат качества ЗАО ЛАБ-2847', dealId: 'DL-9110', urgent: false },
];

export default function SellerPage() {
  const demoMode = useSessionStore(s => s.demoMode);
  const { data, isLoading } = useQuery<{ data: Array<{id:string;grain:string;quantity:number;unit:string;reservedAmount:number;holdAmount:number;riskScore:number;blockers:string[];status:string}> }>({
    queryKey: ['deals'],
    queryFn: () => fetch('/api/deals').then(r => r.json()),
  });

  const deals = data?.data ?? [];
  const active = deals.filter(d => d.status !== 'closed').slice(0, 6);
  const totalExpected = active.reduce((s, d) => s + d.reservedAmount, 0);
  const stuck = active.reduce((s, d) => s + d.holdAmount, 0);
  const blockers = active.filter(d => d.blockers.length > 0).length;

  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  const simulateUpload = (docId: string, docLabel: string, fileName: string) => {
    if (demoMode) {
      // In sandbox mode we simulate the upload with a fake delay
      const newFile: UploadedFile = {
        name: fileName,
        size: Math.floor(Math.random() * 900 + 100) * 1024,
        uploadedAt: new Date().toISOString(),
        status: 'uploading',
        docType: docId,
      };
      setUploadedFiles(prev => [...prev.filter(f => f.docType !== docId), newFile]);
      toast.loading(`Загрузка ${fileName}...`, { id: `upload-${docId}` });

      setTimeout(() => {
        setUploadedFiles(prev => prev.map(f => f.docType === docId ? { ...f, status: 'done' } : f));
        toast.success(`${docLabel} загружен`, { id: `upload-${docId}` });
      }, 1500);
    } else {
      toast.error('Загрузка документов недоступна вне SANDBOX');
    }
  };

  const handleDrop = (e: React.DragEvent, docId: string, docLabel: string) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) simulateUpload(docId, docLabel, file.name);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, docId: string, docLabel: string) => {
    const file = e.target.files?.[0];
    if (file) simulateUpload(docId, docLabel, file.name);
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ borderLeft: '4px solid #16A34A', paddingLeft: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>Воркспейс продавца</h1>
        <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>Ожидаемые деньги, лоты, документы и блокеры</p>
      </div>

      <div className="v9-bento">
        <KpiCard title="Ожидается выплат" value={isLoading ? '—' : `${(totalExpected/1_000_000).toFixed(1)} млн ₽`} loading={isLoading} tone="neutral" />
        <KpiCard title="Заморожено" value={isLoading ? '—' : `${(stuck/1_000).toFixed(0)} тыс. ₽`} loading={isLoading} tone={stuck > 0 ? 'danger' : 'success'} />
        <KpiCard title="Блокеры" value={isLoading ? '—' : String(blockers)} loading={isLoading} tone={blockers > 0 ? 'warning' : 'success'} />
        <KpiCard title="Активных сделок" value={isLoading ? '—' : String(active.length)} loading={isLoading} tone="neutral" />
      </div>

      {/* Document upload section */}
      <section className="v9-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Документы к загрузке</h2>
          <Badge variant="danger" dot>{requiredDocs.filter(d => !uploadedFiles.find(u => u.docType === d.id && u.status === 'done')).length} ожидает</Badge>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requiredDocs.map(doc => {
            const uploaded = uploadedFiles.find(f => f.docType === doc.id);
            const isDone = uploaded?.status === 'done';
            const isUploading = uploaded?.status === 'uploading';

            return (
              <div key={doc.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {isDone
                      ? <CheckCircle2 size={14} color="#16A34A" />
                      : doc.urgent ? <AlertTriangle size={14} color="#DC2626" /> : <Upload size={14} color="#6B778C" />}
                    <span style={{ fontSize: 12, fontWeight: 600, color: isDone ? '#16A34A' : doc.urgent ? '#DC2626' : '#0F1419' }}>
                      {doc.label}
                    </span>
                    <Badge variant="neutral" style={{ fontSize: 10 }}>{doc.dealId}</Badge>
                    {doc.urgent && !isDone && <Badge variant="danger">Срочно</Badge>}
                  </div>
                  {isDone && (
                    <button
                      onClick={() => setUploadedFiles(prev => prev.filter(f => f.docType !== doc.id))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B778C', padding: 2 }}
                      aria-label="Удалить файл"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {isDone ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 6 }}>
                    <FileCheck size={14} color="#16A34A" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#16A34A' }}>{uploaded.name}</div>
                      <div style={{ fontSize: 10, color: '#6B778C' }}>{(uploaded.size / 1024).toFixed(0)} KB · {new Date(uploaded.uploadedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <Badge variant="success">Загружен</Badge>
                  </div>
                ) : isUploading ? (
                  <div style={{ padding: '10px 12px', background: 'rgba(10,122,95,0.04)', border: '1px solid rgba(10,122,95,0.2)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #0A7A5F', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ fontSize: 12, color: '#0A7A5F', fontWeight: 600 }}>Загрузка...</span>
                    </div>
                    <div style={{ height: 3, background: '#E4E6EA', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#0A7A5F', width: '60%', animation: 'progress 1.5s ease-in-out' }} />
                    </div>
                  </div>
                ) : (
                  <label
                    onDragOver={e => { e.preventDefault(); setDragOver(doc.id); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={e => handleDrop(e, doc.id, doc.label)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '16px 12px', borderRadius: 8,
                      border: `2px dashed ${dragOver === doc.id ? '#0A7A5F' : doc.urgent ? 'rgba(220,38,38,0.4)' : '#E4E6EA'}`,
                      background: dragOver === doc.id ? 'rgba(10,122,95,0.04)' : doc.urgent ? 'rgba(220,38,38,0.02)' : '#FAFAFA',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <Upload size={18} color={dragOver === doc.id ? '#0A7A5F' : '#6B778C'} />
                    <span style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>
                      Перетащите файл или <span style={{ color: '#0A7A5F', fontWeight: 600 }}>выберите</span>
                    </span>
                    <span style={{ fontSize: 10, color: '#6B778C', marginTop: 2 }}>PDF, JPEG, PNG · до 20 MB</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      onChange={e => handleFileInput(e, doc.id, doc.label)}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Priority actions */}
      <section className="v9-card" style={{ background: 'rgba(220,38,38,0.03)', border: '1px solid rgba(220,38,38,0.18)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#DC2626', letterSpacing: '0.06em', marginBottom: 8 }}>Приоритетные действия</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { id: 'DL-9102', action: 'Загрузить акт приёмки (форма А)', amount: '3 200 000 ₽' },
            { id: 'DL-9102', action: 'Загрузить форму ЗТТ', amount: '1 760 000 ₽' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>{item.id} · {item.action}</div>
                <div style={{ fontSize: 12, color: '#6B778C', marginTop: 2 }}>Блокирует release {item.amount}</div>
              </div>
              <Button variant="primary" size="sm" asChild>
                <Link href={`/platform-v9/deals/${item.id}`}>→</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* My deals */}
      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Мои сделки</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map(deal => (
            <Link key={deal.id} href={`/platform-v9/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#FAFAFA', borderRadius: 6, border: '1px solid #E4E6EA' }}>
              <div>
                <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: '#0A7A5F' }}>{deal.id}</div>
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2, color: '#495057' }}>{deal.grain} · {deal.quantity} {deal.unit}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {deal.blockers.length > 0 && <Badge variant="warning">Блокер</Badge>}
                {deal.holdAmount > 0 && <Badge variant="danger">Hold</Badge>}
                <span style={{ fontSize: 12, color: '#0A7A5F', fontWeight: 700 }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes progress { from { width: 0; } to { width: 100%; } }
      `}</style>
    </div>
  );
}
