const roles = [
  ['КФХ / продавец', 'Видит, где после отгрузки появился риск: рейс, вес, качество, документы или расчёт.', 'понять следующий шаг и основание задержки'],
  ['Покупатель зерна', 'Сверяет поставку не по звонкам, а по фактам: что приехало, что принято, что подписано.', 'связать приёмку, качество и оплату'],
  ['Элеватор / приёмка', 'Фиксирует вес, очередь, лабораторию и первичные события так, чтобы они не спорили с документами.', 'оставить проверяемый след приёмки'],
  ['Логистика', 'Видит рейс, водителя, маршрут, отклонения и контрольные точки в контексте конкретной сделки.', 'снизить ручные созвоны и спор по срокам'],
  ['Банк / финансирование', 'Получает не голую заявку, а контекст события: что подтверждено и что ещё блокирует расчёт.', 'оценить основание для резерва, удержания или выпуска'],
  ['Регион / инвестор', 'Оценивает не витрину заявок, а управляемость исполнения: документы, качество, логистика, расчёты.', 'смотреть пилот по фактам закрытых сделок'],
];

export default function RoleEntry() {
  return (
    <section id="roles" className="relative z-10 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-mint">кто вы в сделке</div>
          <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Каждый участник теряет в своём месте.</h2>
          <p className="text-lg leading-relaxed text-[#8BA89E]">Пользователь должен сразу узнать свою боль и понять, какой первый результат он получит после заявки.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map(([title, pain, result]) => (
            <a href="#contact" key={title} className="premium-card group rounded-2xl p-6 transition hover:-translate-y-1">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h3 className="text-lg font-black text-white">{title}</h3>
                <span className="shrink-0 rounded-full border border-[rgba(126,242,196,0.12)] px-3 py-1 text-xs text-mint transition group-hover:border-[rgba(126,242,196,0.35)]">разобрать</span>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-[#8BA89E]">{pain}</p>
              <p className="border-t border-[rgba(126,242,196,0.08)] pt-4 text-xs font-semibold leading-relaxed text-[#C9D8D2]">Нужно: {result}.</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
