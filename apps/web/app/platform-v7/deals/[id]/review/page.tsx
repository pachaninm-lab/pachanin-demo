'use client';

import * as React from 'react';
import Link from 'next/link';

const scoreBlocks = [
  { title: 'SLA', value: '4.8', note: 'Соблюдение сроков и предсказуемость исполнения' },
  { title: 'Качество', value: '4.6', note: 'Соответствие факта заявленным параметрам' },
  { title: 'Коммуникация', value: '4.7', note: 'Скорость реакции и прозрачность действий' },
];

const questions = [
  'Насколько контрагент соблюдал сроки?',
  'Были ли расхождения по качеству или документам?',
  'Насколько понятным был денежный контур и выпуск средств?',
  'Готовы ли вы работать с этим контрагентом повторно?',
] as const;

export default function DealReviewPage({ params }: { params: { id: string } }) {
  const [scores, setScores] = React.useState<Record<number, number>>({ 0: 5, 1: 4, 2: 5, 3: 5 });
  const [comment, setComment] = React.useState('Контрагент выполнил сделку в ожидаемом окне. Качество подтверждено без критичной дельты, документы в денежный контур попали без ручного шва. Готовы повторить взаимодействие.');
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const average = (Object.values(scores).reduce((sum, item) => sum + item, 0) / questions.length).toFixed(1);

  function saveReview() {
    setToast(`Отзыв по ${params.id} сохранён. Итоговая оценка: ${average}`);
  }

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 980, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 800 }}>
              Отзыв по сделке
            </div>
            <div style={{ fontSize: 30, lineHeight: 1.08, fontWeight: 800, color: '#0F1419', marginTop: 10 }}>{params.id}</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 760 }}>
              Финальная оценка исполнения: SLA, качество, коммуникация и готовность повторить сделку. Это P1-слой доверия и накопления истории по контрагентам.
            </div>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 800 }}>
              Для закрытых сделок
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 800 }}>
              Итог: {average} / 5
            </span>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {scoreBlocks.map((item) => (
          <div key={item.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{item.title}</div>
            <div style={{ marginTop: 10, fontSize: 30, lineHeight: 1.05, fontWeight: 800, color: '#0F1419' }}>{item.value}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C', lineHeight: 1.5 }}>{item.note}</div>
          </div>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Что оценивается</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {questions.map((item, index) => (
            <div key={item} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, background: '#F8FAFB', display: 'grid', gap: 8 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#475569', fontSize: 11, fontWeight: 800, width: 'fit-content' }}>
                Вопрос {index + 1}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F1419', lineHeight: 1.5 }}>{item}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map((score) => {
                  const active = scores[index] === score;
                  return (
                    <button
                      key={score}
                      onClick={() => setScores((prev) => ({ ...prev, [index]: score }))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        background: active ? 'rgba(10,122,95,0.08)' : '#fff',
                        border: `1px solid ${active ? 'rgba(10,122,95,0.18)' : '#E4E6EA'}`,
                        color: active ? '#0A7A5F' : '#475569',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {score}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Комментарий</div>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={5}
          style={{ width: '100%', border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, background: '#F8FAFB', fontSize: 13, color: '#475569', lineHeight: 1.7, resize: 'vertical' }}
        />
      </section>

      {toast ? (
        <div role='status' aria-live='polite' style={{ padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', borderRadius: 12, color: '#0A7A5F', fontSize: 12, fontWeight: 700 }}>
          {toast}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={saveReview} style={{ padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
          Сохранить отзыв
        </button>
        <Link href={`/platform-v7/deals/${params.id}`} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Вернуться к сделке
        </Link>
        <Link href='/platform-v7/companies/6829123456' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Карточка контрагента
        </Link>
      </div>
    </div>
  );
}
