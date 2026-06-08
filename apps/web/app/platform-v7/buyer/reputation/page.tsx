import Link from 'next/link';
import { ratingAdmission } from '@/lib/platform-v7/reputation';
import { lots } from '@/lib/v7r/esia-fgis-data';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const blue = '#2563EB';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';

interface SellerProfile {
  id: string;
  alias: string;
  region: string;
  totalScore: number;
  qualityAccuracy: number;
  weightAccuracy: number;
  documentDiscipline: number;
  sdizDiscipline: number;
  dealCount: number;
  qualityMismatches: number;
  weightMismatches: number;
  note: string;
}

const SELLER_PROFILES: SellerProfile[] = [
  {
    id: 'SEL-001',
    alias: 'КФХ «Северное поле»',
    region: 'Тамбовская обл.',
    totalScore: 91,
    qualityAccuracy: 94,
    weightAccuracy: 93,
    documentDiscipline: 90,
    sdizDiscipline: 92,
    dealCount: 18,
    qualityMismatches: 0,
    weightMismatches: 1,
    note: 'Качество партий подтверждалось лабораторией в 17 из 18 сделок',
  },
  {
    id: 'SEL-002',
    alias: 'ООО «АгроЮг»',
    region: 'Краснодарский кр.',
    totalScore: 88,
    qualityAccuracy: 89,
    weightAccuracy: 90,
    documentDiscipline: 88,
    sdizDiscipline: 86,
    dealCount: 11,
    qualityMismatches: 1,
    weightMismatches: 0,
    note: 'Одно расхождение по клейковине, покрыто дисконтом',
  },
  {
    id: 'SEL-003',
    alias: 'ИП Воронцов А.В.',
    region: 'Курская обл.',
    totalScore: 76,
    qualityAccuracy: 78,
    weightAccuracy: 80,
    documentDiscipline: 72,
    sdizDiscipline: 74,
    dealCount: 4,
    qualityMismatches: 0,
    weightMismatches: 1,
    note: 'Небольшая история, задержка СДИЗ в одной сделке',
  },
  {
    id: 'SEL-004',
    alias: 'КФХ «Агроресурс»',
    region: 'Воронежская обл.',
    totalScore: 95,
    qualityAccuracy: 97,
    weightAccuracy: 96,
    documentDiscipline: 95,
    sdizDiscipline: 94,
    dealCount: 27,
    qualityMismatches: 0,
    weightMismatches: 0,
    note: 'Высокая точность по всем параметрам, без критических событий',
  },
];

function scoreColor(score: number) {
  if (score >= 85) return green;
  if (score >= 70) return amber;
  return red;
}

const availableLots = lots.filter((l) => l.readiness.state === 'PASS');

export default function BuyerReputationPage() {
  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: blue, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Покупатель</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: text }}>Надёжность продавцов</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Точность качества, вес, документы, СДИЗ, история расхождений и дисциплина по сделкам.
            </p>
          </div>
          <Link href='/platform-v7/buyer/lots' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: blue, color: '#fff', fontSize: 13, fontWeight: 800 }}>
            Доступные лоты
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Продавцов в базе', value: String(SELLER_PROFILES.length), color: text },
            { label: 'Высокий рейтинг', value: String(SELLER_PROFILES.filter((s) => s.totalScore >= 85).length), color: green },
            { label: 'Готовых лотов', value: String(availableLots.length), color: blue },
          ].map((item) => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Продавцы по активным лотам</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {SELLER_PROFILES.map((seller) => {
            const admission = ratingAdmission(seller.totalScore);
            const mainColor = scoreColor(seller.totalScore);
            const hasMismatch = seller.qualityMismatches > 0 || seller.weightMismatches > 0;
            return (
              <div key={seller.id} style={{ border: `1px solid ${hasMismatch ? 'rgba(217,119,6,0.18)' : border}`, borderRadius: 14, padding: 14, background: hasMismatch ? 'rgba(217,119,6,0.03)' : '#F8FAFB', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: text }}>{seller.alias}</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{seller.region} · {seller.dealCount} {seller.dealCount === 1 ? 'сделка' : seller.dealCount <= 4 ? 'сделки' : 'сделок'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: mainColor }}>{seller.totalScore}<span style={{ fontSize: 13, color: muted, fontWeight: 400 }}>/100</span></div>
                    <div style={{ fontSize: 11, color: mainColor, fontWeight: 700, marginTop: 1 }}>{admission.label}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    { label: 'Качество', score: seller.qualityAccuracy },
                    { label: 'Вес', score: seller.weightAccuracy },
                    { label: 'Документы', score: seller.documentDiscipline },
                    { label: 'СДИЗ', score: seller.sdizDiscipline },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: '8px 10px', borderRadius: 10, background: '#fff', border: `1px solid ${border}` }}>
                      <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: scoreColor(item.score), marginTop: 3 }}>{item.score}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: muted, lineHeight: 1.55 }}>{seller.note}</div>
                {(seller.qualityMismatches > 0 || seller.weightMismatches > 0) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {seller.qualityMismatches > 0 && (
                      <span style={{ fontSize: 11, color: amber, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.14)' }}>
                        Расхождений по качеству: {seller.qualityMismatches}
                      </span>
                    )}
                    {seller.weightMismatches > 0 && (
                      <span style={{ fontSize: 11, color: amber, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.14)' }}>
                        Расхождений по весу: {seller.weightMismatches}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/buyer/lots' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: blue, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Найти лот
        </Link>
        <Link href='/platform-v7/buyer/matches' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Подбор под запрос
        </Link>
        <Link href='/platform-v7/buyer' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Кокпит покупателя
        </Link>
      </div>
    </div>
  );
}
