'use client';
import * as React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ClipboardList, Plus, ChevronDown, ChevronUp, Star,
  Clock, CheckCircle2, XCircle, FileText, Send,
} from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { Skeleton } from '@/components/v9/ui/skeleton';
import { useSessionStore } from '@/stores/useSessionStore';
import { hasPermission } from '@/lib/v9/roles';

interface QualityReq {
  moisture: number;
  protein: number;
  impurities: number;
}

interface RfqItem {
  crop: string;
  quantity: number;
  unit: string;
  qualityReq: QualityReq;
  deliveryRegion: string;
  deliveryDateFrom: string;
  deliveryDateTo: string;
  paymentTerms: string;
}

interface RfqOffer {
  id: string;
  seller: { id: string; name: string; rating: number };
  price: number;
  quantity: number;
  submittedAt: string;
  deliveryDate: string;
  notes: string;
  status: 'submitted' | 'accepted' | 'rejected';
}

interface Rfq {
  id: string;
  status: 'open' | 'closed' | 'expired';
  createdAt: string;
  expiresAt: string;
  buyer: { id: string; name: string };
  items: RfqItem[];
  offers: RfqOffer[];
  description: string;
  selectedOfferId?: string;
  dealId?: string;
}

function fmt(n: number) { return n.toLocaleString('ru-RU') + ' ₽'; }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function daysLeft(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

const statusConfig = {
  open: { label: 'Открыт', variant: 'success' as const, icon: Clock },
  closed: { label: 'Закрыт', variant: 'neutral' as const, icon: CheckCircle2 },
  expired: { label: 'Истёк', variant: 'danger' as const, icon: XCircle },
};

interface CreateRfqFormProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateRfqForm({ onClose, onCreated }: CreateRfqFormProps) {
  const { demoMode } = useSessionStore();
  const [crop, setCrop] = React.useState('Пшеница 4 кл.');
  const [qty, setQty] = React.useState('500');
  const [region, setRegion] = React.useState('Краснодарский кр.');
  const [paymentTerms, setPaymentTerms] = React.useState('Аккредитив / Номинальный счёт Сбер');
  const [description, setDescription] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/rfq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crop, quantity: Number(qty), deliveryRegion: region, paymentTerms, description }),
    });
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
    toast.success(demoMode ? '[SANDBOX] RFQ создан — поставщики уведомлены' : 'RFQ создан');
    onCreated();
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid #E4E6EA',
    borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Создать RFQ (Запрос котировок)</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B778C' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B778C', display: 'block', marginBottom: 4 }}>Культура</label>
            <select value={crop} onChange={e => setCrop(e.target.value)} style={inputStyle}>
              <option>Пшеница 4 кл.</option>
              <option>Пшеница 3 кл.</option>
              <option>Ячмень 2 кл.</option>
              <option>Кукуруза 3 кл.</option>
              <option>Подсолнечник</option>
              <option>Рапс</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B778C', display: 'block', marginBottom: 4 }}>Объём, т</label>
            <input
              type="number" min="1" required value={qty}
              onChange={e => setQty(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B778C', display: 'block', marginBottom: 4 }}>Регион поставки</label>
            <input
              type="text" required value={region}
              onChange={e => setRegion(e.target.value)}
              style={inputStyle}
              placeholder="Краснодарский кр."
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B778C', display: 'block', marginBottom: 4 }}>Условия оплаты</label>
            <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} style={inputStyle}>
              <option>Аккредитив / Номинальный счёт Сбер</option>
              <option>Предоплата 100%</option>
              <option>Предоплата 50%</option>
              <option>Аккредитив</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B778C', display: 'block', marginBottom: 4 }}>Описание / требования</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              rows={3} style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Дополнительные требования к качеству, условия..."
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
            <Button type="submit" variant="primary" size="sm" loading={loading}>
              <Send size={13} /> {loading ? 'Создание...' : 'Разослать поставщикам'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface OfferRowProps {
  offer: RfqOffer;
  rfqId: string;
  rfqStatus: string;
  onAccepted: () => void;
}

function OfferRow({ offer, rfqId, rfqStatus, onAccepted }: OfferRowProps) {
  const { demoMode } = useSessionStore();
  const [accepting, setAccepting] = React.useState(false);

  async function handleAccept() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/rfq/${rfqId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id }),
      });
      const data = await res.json();
      toast.success(demoMode ? `[SANDBOX] Оферта принята — создана сделка ${data.dealId}` : `Сделка ${data.dealId} создана`);
      onAccepted();
    } finally {
      setAccepting(false);
    }
  }

  const stars = Math.round(offer.seller.rating);

  return (
    <div style={{
      padding: '12px 14px',
      background: offer.status === 'accepted' ? 'rgba(10,122,95,0.04)' : '#FAFAFA',
      border: `1px solid ${offer.status === 'accepted' ? 'rgba(10,122,95,0.25)' : '#E4E6EA'}`,
      borderRadius: 8,
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 12,
      alignItems: 'center',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{offer.seller.name}</span>
          <span style={{ color: '#D97706', fontSize: 12 }}>
            {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
          </span>
          <span style={{ fontSize: 11, color: '#6B778C' }}>{offer.seller.rating}</span>
          {offer.status === 'accepted' && <Badge variant="success">Принята</Badge>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0A7A5F', marginTop: 4 }}>
          {fmt(offer.price)}/т · {offer.quantity} т
        </div>
        <div style={{ fontSize: 11, color: '#6B778C', marginTop: 2 }}>
          Поставка: {fmtDate(offer.deliveryDate)} · Подана: {fmtDate(offer.submittedAt)}
        </div>
        {offer.notes && (
          <div style={{ fontSize: 11, color: '#495057', marginTop: 3, fontStyle: 'italic' }}>{offer.notes}</div>
        )}
      </div>
      <div>
        {rfqStatus === 'open' && offer.status === 'submitted' && (
          <Button
            variant="primary"
            size="sm"
            loading={accepting}
            onClick={handleAccept}
          >
            <CheckCircle2 size={13} />
            {accepting ? 'Создание сделки...' : 'Принять оферту'}
          </Button>
        )}
        {offer.status === 'accepted' && (
          <Badge variant="success" dot>Сделка создана</Badge>
        )}
      </div>
    </div>
  );
}

interface RfqCardProps {
  rfq: Rfq;
  onRefetch: () => void;
}

function RfqCard({ rfq, onRefetch }: RfqCardProps) {
  const { demoMode } = useSessionStore();
  const [expanded, setExpanded] = React.useState(rfq.status === 'open');
  const [submittingOffer, setSubmittingOffer] = React.useState(false);
  const [offerPrice, setOfferPrice] = React.useState('');
  const [offerQty, setOfferQty] = React.useState('');
  const [offerNotes, setOfferNotes] = React.useState('');
  const [showOfferForm, setShowOfferForm] = React.useState(false);
  const { role } = useSessionStore();
  const canSubmitOffer = role === 'seller' || role === 'operator' || role === 'admin';

  const cfg = statusConfig[rfq.status];
  const StatusIcon = cfg.icon;
  const item = rfq.items[0];
  const bestOffer = rfq.offers.length > 0
    ? rfq.offers.reduce((a, b) => a.price < b.price ? a : b)
    : null;

  async function handleSubmitOffer(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingOffer(true);
    try {
      await fetch(`/api/rfq/${rfq.id}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: Number(offerPrice), quantity: Number(offerQty), notes: offerNotes }),
      });
      toast.success(demoMode ? '[SANDBOX] Оферта подана — ожидайте решения покупателя' : 'Оферта подана');
      setShowOfferForm(false);
      setOfferPrice(''); setOfferQty(''); setOfferNotes('');
      onRefetch();
    } finally {
      setSubmittingOffer(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', border: '1px solid #E4E6EA', borderRadius: 6,
    fontSize: 12, fontFamily: 'inherit',
  };

  return (
    <div style={{ border: '1px solid #E4E6EA', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header row */}
      <div
        style={{
          padding: '14px 16px', background: '#FAFAFA', cursor: 'pointer',
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
        }}
        onClick={() => setExpanded(v => !v)}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{rfq.id}</span>
            <Badge variant={cfg.variant}>
              <StatusIcon size={10} style={{ marginRight: 3, display: 'inline' }} />
              {cfg.label}
            </Badge>
            {rfq.status === 'open' && <Badge variant="warning">{daysLeft(rfq.expiresAt)} дн. до истечения</Badge>}
            {rfq.dealId && (
              <Link href={`/platform-v7/deals/${rfq.dealId}`} onClick={e => e.stopPropagation()}>
                <Badge variant="success" style={{ cursor: 'pointer' }}>
                  <FileText size={9} style={{ marginRight: 3, display: 'inline' }} />
                  Сделка {rfq.dealId}
                </Badge>
              </Link>
            )}
            {demoMode && <Badge variant="neutral">SANDBOX</Badge>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F1419', marginTop: 4 }}>
            {item?.crop} · {item?.quantity} {item?.unit}
          </div>
          <div style={{ fontSize: 12, color: '#6B778C', marginTop: 2 }}>
            {rfq.buyer.name} · {item?.deliveryRegion} · Истекает {fmtDate(rfq.expiresAt)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Офертов</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0A7A5F' }}>{rfq.offers.length}</div>
          </div>
          {bestOffer && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#6B778C' }}>Лучшая цена</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0A7A5F' }}>{fmt(bestOffer.price)}/т</div>
            </div>
          )}
          {expanded ? <ChevronUp size={16} color="#6B778C" /> : <ChevronDown size={16} color="#6B778C" />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid #E4E6EA' }}>

          {/* Description & requirements */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Описание</div>
              <p style={{ margin: 0, fontSize: 12, color: '#495057', lineHeight: 1.5 }}>{rfq.description || '—'}</p>
            </div>
            {item && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Требования к качеству</div>
                {[
                  ['Влажность', `≤ ${item.qualityReq.moisture}%`],
                  ['Протеин', `≥ ${item.qualityReq.protein}%`],
                  ['Сорная примесь', `≤ ${item.qualityReq.impurities}%`],
                  ['Доставка', `${fmtDate(item.deliveryDateFrom)} – ${fmtDate(item.deliveryDateTo)}`],
                  ['Оплата', item.paymentTerms],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid #F4F5F7' }}>
                    <span style={{ color: '#6B778C' }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Offers */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', marginBottom: 10 }}>
              Офертов: {rfq.offers.length}
              {bestOffer && (
                <span style={{ marginLeft: 8, fontWeight: 400, color: '#6B778C' }}>
                  · Лучшая: {fmt(bestOffer.price)}/т от {bestOffer.seller.name}
                </span>
              )}
            </div>
            {rfq.offers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#6B778C', fontSize: 12 }}>
                Ни один поставщик ещё не подал оферту
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rfq.offers.map(offer => (
                  <OfferRow
                    key={offer.id}
                    offer={offer}
                    rfqId={rfq.id}
                    rfqStatus={rfq.status}
                    onAccepted={onRefetch}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Seller offer form */}
          {canSubmitOffer && rfq.status === 'open' && (
            <div>
              {!showOfferForm ? (
                <Button variant="primary" size="sm" onClick={() => setShowOfferForm(true)}>
                  <Plus size={13} /> Подать оферту
                </Button>
              ) : (
                <form onSubmit={handleSubmitOffer} style={{ padding: '14px 16px', background: 'rgba(10,122,95,0.03)', border: '1px solid rgba(10,122,95,0.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Новая оферта</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: '#6B778C', display: 'block', marginBottom: 3 }}>Цена, ₽/т</label>
                      <input
                        type="number" required min="1" value={offerPrice}
                        onChange={e => setOfferPrice(e.target.value)}
                        style={inputStyle}
                        placeholder="15000"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#6B778C', display: 'block', marginBottom: 3 }}>Объём, т</label>
                      <input
                        type="number" required min="1" value={offerQty}
                        onChange={e => setOfferQty(e.target.value)}
                        style={inputStyle}
                        placeholder={String(item?.quantity ?? 100)}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: '#6B778C', display: 'block', marginBottom: 3 }}>Примечания</label>
                    <input
                      type="text" value={offerNotes}
                      onChange={e => setOfferNotes(e.target.value)}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                      placeholder="Готовность к отгрузке, ФГИС, условия..."
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button type="submit" variant="primary" size="sm" loading={submittingOffer}>
                      <Send size={12} /> {submittingOffer ? 'Отправка...' : 'Подать оферту'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowOfferForm(false)}>Отмена</Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProcurementPage() {
  const { role, demoMode } = useSessionStore();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = React.useState(false);
  const [filter, setFilter] = React.useState<'all' | 'open' | 'closed'>('all');
  const canCreate = hasPermission(role, 'deal.edit') || role === 'buyer' || role === 'operator' || role === 'admin';

  const { data: rfqs, isLoading, isError, refetch } = useQuery<Rfq[]>({
    queryKey: ['rfq'],
    queryFn: () => fetch('/api/rfq').then(r => r.json()),
  });

  const filtered = rfqs?.filter(r => filter === 'all' || r.status === filter) ?? [];
  const openCount = rfqs?.filter(r => r.status === 'open').length ?? 0;
  const closedCount = rfqs?.filter(r => r.status === 'closed').length ?? 0;
  const totalOffers = rfqs?.reduce((s, r) => s + r.offers.length, 0) ?? 0;

  function handleCreated() {
    setShowCreate(false);
    refetch();
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton className="h-16" />
        {[0,1,2].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  if (isError) {
    return <div style={{ textAlign: 'center', padding: 32, color: '#DC2626' }}>Ошибка загрузки RFQ</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <ClipboardList size={22} color="#0A7A5F" />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F1419' }}>Закупки (RFQ)</h1>
            {demoMode && <Badge variant="neutral">SANDBOX</Badge>}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#6B778C' }}>
            Запросы котировок · покупатели публикуют лоты, поставщики подают офертыs → принятая оферта становится сделкой
          </p>
        </div>
        {canCreate && (
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Создать RFQ
          </Button>
        )}
      </div>

      {/* KPI bar */}
      <div className="v9-bento" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { label: 'Открытых RFQ', value: openCount, color: '#0A7A5F' },
          { label: 'Офертов всего', value: totalOffers, color: '#D97706' },
          { label: 'Закрытых RFQ', value: closedCount, color: '#6B778C' },
        ].map(({ label, value, color }) => (
          <div key={label} className="v9-card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['all', 'open', 'closed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 14px', borderRadius: 20, border: '1px solid',
              borderColor: filter === f ? '#0A7A5F' : '#E4E6EA',
              background: filter === f ? 'rgba(10,122,95,0.08)' : '#fff',
              color: filter === f ? '#0A7A5F' : '#6B778C',
              fontSize: 12, fontWeight: filter === f ? 700 : 400, cursor: 'pointer',
            }}
          >
            {f === 'all' ? 'Все' : f === 'open' ? 'Открытые' : 'Закрытые'}
          </button>
        ))}
      </div>

      {/* RFQ list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#6B778C' }}>
          <ClipboardList size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14 }}>Нет запросов котировок</p>
          {canCreate && (
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} style={{ marginTop: 8 }}>
              <Plus size={13} /> Создать первый RFQ
            </Button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(rfq => (
            <RfqCard key={rfq.id} rfq={rfq} onRefetch={refetch} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateRfqForm onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
