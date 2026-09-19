const result = [
  ['Карта потерь', 'где после цены возникает риск денег'],
  ['Блокеры денег', 'что мешает выпуску или финальному расчёту'],
  ['Слабые места', 'где не хватает следа: маршрут, вес, лаборатория, ЭДО, СДИЗ'],
  ['Следующий шаг', 'что делать первым и кто владелец действия'],
];

const money = [
  ['Сумма сделки', '240 т x 16 140 ₽', '3 873 600 ₽'],
  ['К выпуску', '70% после подтверждений', '2 711 520 ₽'],
  ['Под удержанием', '30% до сверки', '1 162 080 ₽'],
  ['Комиссия модели', '0,15%', '5 810 ₽'],
];

const trust = [
  ['СберБизнес ID', 'сценарий входа и регистрации компаний и ИП через продукт экосистемы Сбера'],
  ['Безопасные сделки', 'предынтеграционный сценарий номинального счёта, резерва, выпуска и возврата'],
  ['СберКорус', 'документный слой: ЭДО, ЭПД, МЧД и транспортный пакет'],
  ['Оплата в кредит', 'возможный B2B-кредитный виджет для покупателя после договора и доступа'],
  ['AI-карта рисков', 'ИИ подсвечивает блокеры, документы, спорность и следующий шаг'],
  ['Минсельхоз / регион', 'пилотная рамка соответствует повестке цифровизации АПК'],
];

const chain = ['продавец', 'покупатель', 'перевозчик', 'приёмка', 'лаборатория', 'ЭДО / СДИЗ', 'банк'];

function Badge({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-mint">{children}</div>;
}

export default function LandingTrustBlocks() {
  return (
    <>
      <section id="result" className="relative z-10 py-24"><div className="mx-auto max-w-7xl px-6"><Badge>что получает участник</Badge><h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Первый продукт — не демо. Карта потерь одной сделки.</h2><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{result.map(([a,b])=><div key={a} className="premium-card rounded-2xl p-6"><h3 className="mb-3 text-lg font-black text-white">{a}</h3><p className="text-sm leading-relaxed text-[#8BA89E]">{b}</p></div>)}</div></div></section>
      <section id="money" className="lux-line relative z-10 py-24 grid-bg"><div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.85fr_1.15fr]"><div><Badge>финансовая логика</Badge><h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Где на одной сделке теряются деньги.</h2><p className="text-lg leading-relaxed text-[#8BA89E]">Модельная сделка: 240 т по 16 140 ₽/т. Платформа показывает риск, удержание, основание и следующий проверяемый шаг.</p></div><div className="premium-panel rounded-3xl p-6"><div className="space-y-3">{money.map(([a,b,c])=><div key={a} className="grid gap-3 rounded-2xl border border-[rgba(126,242,196,0.08)] bg-[#111C19] p-4 md:grid-cols-[1fr_0.8fr_0.8fr]"><div className="font-semibold text-white">{a}</div><div className="text-sm text-[#8BA89E]">{b}</div><div className="font-mono text-lg font-black text-mint md:text-right">{c}</div></div>)}</div></div></div></section>
      <section id="trust" className="relative z-10 py-24"><div className="mx-auto max-w-7xl px-6"><Badge>Сбер · AI · Минсельхоз</Badge><h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Доверительный слой виден, но без лишних обещаний.</h2><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{trust.map(([a,b])=><div key={a} className="premium-card rounded-2xl p-6"><h3 className="mb-3 text-lg font-black text-white">{a}</h3><p className="text-sm leading-relaxed text-[#8BA89E]">{b}</p></div>)}</div><div className="mt-6 rounded-3xl border border-[rgba(245,180,30,0.18)] bg-[rgba(245,180,30,0.06)] p-6 text-sm leading-relaxed text-[#D7C895]">Live-интеграции со Сбером, СберКорус, ФГИС, ЭДО, ГИС ЭПД, КЭП/МЧД и банковым контуром требуют договора, доступа, настройки и проверки на реальной цепочке.</div></div></section>
      <section id="pilot-chain" className="lux-line relative z-10 py-24 grid-bg"><div className="mx-auto max-w-7xl px-6"><Badge>controlled pilot</Badge><h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Нужна одна рабочая цепочка, а не массовая регистрация.</h2><div className="grid gap-3 md:grid-cols-7">{chain.map((p,i)=><div key={p} className="premium-card rounded-2xl p-5"><div className="mb-4 font-mono text-xs text-[#4A6B5E]">{String(i+1).padStart(2,'0')}</div><div className="text-sm font-black text-white">{p}</div></div>)}</div></div></section>
    </>
  );
}
