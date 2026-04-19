import Link from 'next/link';

const FAQ = [
  {
    title: 'Почему деньги не выпускаются?',
    body: 'Проверь три вещи: документы сделки, статус банка и наличие открытого спора. Если в карточке сделки есть красные причины в блоке «Почему выпуск заблокирован», деньги не пойдут, пока они не закрыты.',
  },
  {
    title: 'Как снять blocker?',
    body: 'Открой Control Tower и найди сделку в очереди проблем. Если blocker интеграционный, оператор может снять gate и отправить сделку дальше в банк. Если blocker документный — загрузи недостающие файлы в документы сделки.',
  },
  {
    title: 'Что обязательно нужно для выпуска?',
    body: 'Минимум: контракт, лабораторный протокол, акт сюрвейера или приёмки и подтверждение банкового резерва. Эти позиции отмечаются на странице документов сделки.',
  },
  {
    title: 'Как открыть спор?',
    body: 'Перейди в карточку сделки или раздел «Споры», открой нужный кейс и сформируй пакет доказательств. После этого можно отправить напоминание контрагенту и передать спор на разбор.',
  },
  {
    title: 'Как быстро найти сделку?',
    body: 'Используй Cmd/Ctrl+K, / или сочетания g+d, g+s, g+l. Поиск понимает номера сделок, лотов и споров, а также хранит недавние переходы.',
  },
];

export default function HelpPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Справочный центр</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Короткие ответы по ролям, деньгам, документам и спорам. Это рабочий справочник оператора, а не маркетинговая страница.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <QuickLink href='/platform-v7/control-tower' title='Control Tower' note='Очередь проблем, SLA, блокеры, действия.' />
        <QuickLink href='/platform-v7/deals' title='Сделки' note='Реестр сделок с фильтрами, риском и batch actions.' />
        <QuickLink href='/platform-v7/bank' title='Банк' note='Резерв, release, события callback и удержания.' />
        <QuickLink href='/platform-v7/disputes' title='Споры' note='Открытые кейсы, доказательства, сроки и действия.' />
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Частые вопросы</div>
        {FAQ.map((item) => (
          <article key={item.title} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, background: '#F8FAFB' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#475569', lineHeight: 1.65 }}>{item.body}</div>
          </article>
        ))}
      </section>
    </div>
  );
}

function QuickLink({ href, title, note }: { href: string; title: string; note: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>{note}</div>
    </Link>
  );
}
