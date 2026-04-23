import Link from 'next/link';

const FAQ = [
  {
    title: 'Почему деньги не выпускаются?',
    body: 'Проверь три вещи: документы сделки, статус банка и наличие открытого спора. Если в карточке сделки есть красные причины в блоке «Почему выпуск заблокирован», деньги не пойдут, пока они не закрыты.',
    bucket: 'Деньги',
  },
  {
    title: 'Как снять блокировку?',
    body: 'Открой Центр управления и найди сделку в очереди проблем. Если блокировка связана с интеграцией, оператор может перевести проверку в статус «пройдено» и отправить сделку дальше в банк. Если причина в документах — загрузи недостающие файлы в документы сделки.',
    bucket: 'Оператор',
  },
  {
    title: 'Что обязательно нужно для выпуска?',
    body: 'Минимум: контракт, лабораторный протокол, акт сюрвейера или приёмки и подтверждение банкового резерва. Эти позиции отмечаются на странице документов сделки.',
    bucket: 'Документы',
  },
  {
    title: 'Как открыть спор?',
    body: 'Перейди в карточку сделки или раздел «Споры», открой нужный кейс и сформируй пакет доказательств. После этого можно отправить напоминание контрагенту и передать спор на разбор.',
    bucket: 'Споры',
  },
  {
    title: 'Как быстро найти сделку?',
    body: 'Используй Cmd/Ctrl+K, / или сочетания g+d, g+s, g+l. Поиск понимает номера сделок, лотов и споров, а также хранит недавние переходы.',
    bucket: 'Навигация',
  },
  {
    title: 'Зачем нужен онбординг компании?',
    body: 'Онбординг нужен, чтобы не собирать профиль, документы, банковый слой и первый лот вручную по разным разделам. Это единый вход в подключение компании.',
    bucket: 'Подключение',
  },
  {
    title: 'Чем отличаются факторинг и эскроу?',
    body: 'Факторинг — это финансирование покупателя или денежного потока сделки. Эскроу — это резервирование денег до наступления подтверждённых условий раскрытия.',
    bucket: 'Банк',
  },
  {
    title: 'Зачем нужны отзывы и карточки контрагентов?',
    body: 'Они фиксируют повторяемость исполнения: как контрагент ведёт себя по SLA, качеству, коммуникации и спорности. Это не маркетинг, а слой доверия после сделки.',
    bucket: 'Доверие',
  },
];

const FILTERS = ['Деньги', 'Оператор', 'Документы', 'Споры', 'Навигация', 'Подключение', 'Банк', 'Доверие'];

export default function HelpPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Справочный центр</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Короткие ответы по ролям, деньгам, документам, спорам и новым модулям платформы. Это рабочий справочник, а не маркетинговая страница.
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: '#0F1419' }}>Быстрые входы</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>
            Основные рабочие разделы и новые поверхности, которые уже встроены в платформу.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <QuickLink href='/platform-v7/control-tower' title='Центр управления' note='Очередь проблем, SLA, блокировки и действия оператора.' />
          <QuickLink href='/platform-v7/deals' title='Сделки' note='Реестр сделок с фильтрами, риском и контекстом.' />
          <QuickLink href='/platform-v7/bank' title='Банк' note='Резерв, выпуск денег, входящие события, факторинг и эскроу.' />
          <QuickLink href='/platform-v7/disputes' title='Споры' note='Открытые кейсы, доказательства, сроки и действия.' />
          <QuickLink href='/platform-v7/onboarding' title='Онбординг' note='6 шагов от подключения компании до первого лота.' />
          <QuickLink href='/platform-v7/profile' title='Профиль компании' note='Команда, доверие, доступы и связанный контур.' />
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: '#0F1419' }}>Фильтры тем</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>
            Быстрый обзор, по каким зонам уже собран справочный слой.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((filter) => (
            <span key={filter} style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 800 }}>
              {filter}
            </span>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Частые вопросы</div>
        {FAQ.map((item) => (
          <article key={item.title} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, background: '#F8FAFB' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#475569', fontSize: 11, fontWeight: 800 }}>{item.bucket}</span>
            </div>
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
      <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>Открыть →</div>
    </Link>
  );
}
