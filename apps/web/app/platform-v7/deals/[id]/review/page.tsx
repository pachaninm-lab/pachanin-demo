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
];

export default function DealReviewPage({ params }: { params: { id: string } }) {
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
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 800 }}>
            Для закрытых сделок
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
                {[1, 2, 3, 4, 5].map((score) => (
                  <span key={score} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 999, background: score >= 4 ? 'rgba(10,122,95,0.08)' : '#fff', border: `1px solid ${score >= 4 ? 'rgba(10,122,95,0.18)' : '#E4E6EA'}`, color: score >= 4 ? '#0A7A5F' : '#475569', fontSize: 12, fontWeight: 800 }}>
                    {score}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Комментарий</div>
        <div style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, background: '#F8FAFB', fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
          Контрагент выполнил сделку в ожидаемом окне. Качество подтверждено без критичной дельты, документы в денежный контур попали без ручного шва. Готовы повторить взаимодействие.
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/platform-v7/deals/${params.id}`} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Вернуться к сделке
        </Link>
        <Link href='/platform-v7/companies/6829123456' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Карточка контрагента
        </Link>
      </div>
    </div>
  );
}
