import Link from 'next/link';

export default function AboutPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>О проекте</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Прозрачная Цена — это не витрина объявлений, а цифровой контур исполнения внебиржевой сделки: от допуска и цены до документов, денег и спора.
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Что делает система</div>
        <Bullet text='Держит сделку в одном контуре, а не разносит её по чатам и звонкам.' />
        <Bullet text='Показывает следующий шаг, владельца и причину блокировки денег.' />
        <Bullet text='Связывает логистику, документы, приёмку, банк и спор в одну цепочку.' />
        <Bullet text='Даёт доказательную базу для оператора, банка и арбитража.' />
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Контакты и реквизиты</div>
        <Cell label='Компания' value='ООО «Прозрачная Цена»' />
        <Cell label='Юридический адрес' value='Тамбовская область' />
        <Cell label='Email' value='info@prozprice.demo' />
        <Cell label='Телефон поддержки' value='+7 (000) 000-00-00' />
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Вернуться в платформу
        </Link>
        <Link href='/platform-v7/status' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Статус сервисов
        </Link>
      </div>
    </div>
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

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#F8FAFB' }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{value}</div>
    </div>
  );
}
