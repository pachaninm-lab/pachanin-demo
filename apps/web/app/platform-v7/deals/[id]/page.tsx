import Link from 'next/link';
import { DealDetailRuntime } from '@/components/v7r/DealDetailRuntime';
import { getDealById, getDealIntegrationState } from '@/lib/v7r/data';

interface CounterpartyProfile {
  inn: string | null;
  region: string;
  rating: string;
  badges: string[];
  note: string;
}

const COUNTERPARTIES: Record<string, CounterpartyProfile> = {
  'Агрохолдинг СК': {
    inn: '6829123456',
    region: 'Тамбовская область',
    rating: '4.8 / 5',
    badges: ['ФГИС проверено', 'Низкий риск', 'Повторные сделки'],
    note: 'Якорный покупатель пилотного контура со стабильной банковой дисциплиной.',
  },
  'МаслоПресс ООО': {
    inn: '3664098765',
    region: 'Воронежская область',
    rating: '4.6 / 5',
    badges: ['Документы в контуре', 'Стабильная приёмка'],
    note: 'Рабочий контрагент по масличным, требует аккуратного контроля качества.',
  },
  'ПромАгро АО': {
    inn: '7701234567',
    region: 'Москва',
    rating: '4.4 / 5',
    badges: ['Высокий объём', 'Ручные проверки банка'],
    note: 'Крупный контрагент, которому нужен жёсткий SLA и контроль ролей.',
  },
};

const FALLBACK_PROFILE: CounterpartyProfile = {
  inn: null,
  region: 'Карточка заполняется',
  rating: '—',
  badges: ['Профиль дополняется'],
  note: 'Карточка контрагента ещё не вынесена в отдельный верифицированный профиль.',
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}

function counterpartyByName(name: string): CounterpartyProfile {
  return COUNTERPARTIES[name] ?? FALLBACK_PROFILE;
}

function tonePalette(tone: 'good' | 'warn' | 'danger') {
  if (tone === 'good') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (tone === 'warn') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
}

export default function PlatformV7DealDetailPage({ params }: { params: { id: string } }) {
  const deal = getDealById(params.id);
  const integration = deal ? getDealIntegrationState(deal.id, deal.lotId) : null;
  const seller = deal ? counterpartyByName(deal.seller.name) : FALLBACK_PROFILE;
  const buyer = deal ? counterpartyByName(deal.buyer.name) : FALLBACK_PROFILE;

  const guarantees = deal && integration
    ? [
        {
          title: 'Резерв денег',
          value: deal.reservedAmount > 0 ? 'Подтверждён' : 'Не подтверждён',
          note: deal.reservedAmount > 0 ? `${formatMoney(deal.reservedAmount)} зафиксировано в банковом контуре.` : 'Без резерва платформа не должна обещать выпуск.',
          tone: deal.reservedAmount > 0 ? 'good' as const : 'warn' as const,
        },
        {
          title: 'Документы',
          value: deal.blockers.includes('docs') ? 'Пакет неполный' : 'Критичных пробелов нет',
          note: deal.blockers.includes('docs') ? 'Не хватает документов для выпуска денег.' : 'Документный слой не красный для текущего этапа.',
          tone: deal.blockers.includes('docs') ? 'danger' as const : 'good' as const,
        },
        {
          title: 'ФГИС / ЕСИА',
          value: integration.gateState === 'PASS' ? 'Контур чист' : integration.gateState === 'REVIEW' ? 'Нужна проверка' : 'Gate блокирует выпуск',
          note: integration.summary,
          tone: integration.gateState === 'PASS' ? 'good' as const : integration.gateState === 'REVIEW' ? 'warn' as const : 'danger' as const,
        },
        {
          title: 'Спор и удержание',
          value: deal.holdAmount > 0 ? 'Есть hold' : 'Hold не активен',
          note: deal.holdAmount > 0 ? `${formatMoney(deal.holdAmount)} удержано до закрытия причины.` : 'По деньгам нет активного удержания.',
          tone: deal.holdAmount > 0 ? 'danger' as const : 'good' as const,
        },
      ]
    : [];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <DealDetailRuntime id={params.id} />

      {deal && integration ? (
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Доверие и прозрачность</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0F1419' }}>Гарантии сделки</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.6, maxWidth: 920 }}>
              Здесь нет маркетинговых обещаний. Только проверяемые условия: резерв денег, документный слой, интеграционный gate и наличие либо отсутствие удержания.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <CounterpartyCard role='Продавец' name={deal.seller.name} profile={seller} />
            <CounterpartyCard role='Покупатель' name={deal.buyer.name} profile={buyer} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {guarantees.map((item) => {
              const tone = tonePalette(item.tone);
              return (
                <article key={item.title} style={{ border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, background: '#F8FAFB', display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{item.title}</div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 800 }}>
                      {item.value}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{item.note}</div>
                </article>
              );
            })}
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>Что реально даёт платформа</div>
            <Bullet text='Не даёт обещать выпуск денег, если пакет документов, качество или интеграционный gate красные.' />
            <Bullet text='Показывает, кто именно следующий владелец действия, вместо размытых статусов.' />
            <Bullet text='Сводит доверие к проверяемым сигналам: рейтинг контрагента, история сделок, спорность и резерв.' />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CounterpartyCard({ role, name, profile }: { role: string; name: string; profile: CounterpartyProfile }) {
  return (
    <article style={{ border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, background: '#F8FAFB', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{role}</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{name}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>
            {profile.inn ? `ИНН ${profile.inn} · ${profile.region}` : profile.region}
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 11, fontWeight: 800 }}>
          Рейтинг {profile.rating}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {profile.badges.map((badge) => (
          <span key={badge} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#475569', fontSize: 11, fontWeight: 700 }}>
            {badge}
          </span>
        ))}
      </div>

      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{profile.note}</div>

      {profile.inn ? (
        <Link href={`/platform-v7/counterparty/${profile.inn}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 800 }}>
          Открыть профиль контрагента
        </Link>
      ) : null}
    </article>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
      <span style={{ fontWeight: 900 }}>•</span>
      <span>{text}</span>
    </div>
  );
}
