import '@/styles/platform-v7-control-tower-grain.css';
import Link from 'next/link';
import { P7Page } from '@/components/platform-v7/P7Page';
import { P7Section } from '@/components/platform-v7/P7Section';

const routes = [
  {
    step: '01',
    title: 'Партии зерна',
    detail: 'Готовность партии, объём, место хранения, ФГИС, качество и следующий шаг.',
    href: '/platform-v7/batches',
  },
  {
    step: '02',
    title: 'Закупочные запросы',
    detail: 'Потребность покупателя, подбор партии, расчёт цены до точки и риск сделки.',
    href: '/platform-v7/buyer/rfq',
  },
  {
    step: '03',
    title: 'Качество',
    detail: 'Лаборатория, отклонения, денежная дельта и удержание спорной части.',
    href: '/platform-v7/deals/grain-quality',
  },
  {
    step: '04',
    title: 'Вес',
    detail: 'Договорный вес, принято нетто, зачётный вес и денежный эффект расхождения.',
    href: '/platform-v7/deals/grain-weight',
  },
  {
    step: '05',
    title: 'СДИЗ и документы',
    detail: 'Допуск отгрузки, приёмки и выпуска денег через документальный контур.',
    href: '/platform-v7/deals/grain-sdiz',
  },
  {
    step: '06',
    title: 'Деньги',
    detail: 'Резерв, удержание, частичный выпуск через банк и причина остановки.',
    href: '/platform-v7/deals/grain-release',
  },
  {
    step: '07',
    title: 'Сквозной сценарий',
    detail: 'Проверка всей цепочки: партия → запрос → сделка → документы → деньги → спор.',
    href: '/platform-v7/demo/grain-execution',
  },
];

export default function PlatformV7GrainControlTowerPage() {
  return (
    <>
      <P7Page
        title='Зерновой контур исполнения'
        subtitle='Операторская точка входа в новую цепочку: партия, закупочный запрос, качество, вес, СДИЗ, документы, деньги и сквозной сценарий.'
        testId='platform-v7-control-tower-grain-page'
      >
        <P7Section
          title='Рабочие зоны'
          subtitle='Каждая карточка ведёт не в презентацию, а в конкретную часть исполнения сделки.'
        >
          <section className='grain-control-grid'>
            {routes.map((route) => (
              <Link key={route.href} href={route.href} className='grain-control-card'>
                <span className='grain-control-step'>{route.step}</span>
                <p className='grain-control-title'>{route.title}</p>
                <p className='grain-control-detail'>{route.detail}</p>
              </Link>
            ))}
          </section>
        </P7Section>

        <P7Section
          title='Как читать этот контур'
          subtitle='Экран нужен для быстрой проверки, где сейчас сделка и почему деньги не должны выпускаться раньше фактического закрытия условий.'
        >
          <section className='grain-control-note'>
            <div><strong>Главный объект:</strong> сделка, а не витрина лотов.</div>
            <div><strong>Деньги:</strong> выпускаются только после проверки качества, веса, документов, СДИЗ и причин удержания.</div>
            <div><strong>Ручные действия:</strong> допустимы только с причиной, ответственным и следом в журнале.</div>
            <div><strong>Интеграции:</strong> отображаются как тестовый, ручной или требующий боевого подключения контур без завышения зрелости.</div>
          </section>
        </P7Section>
      </P7Page>
    </>
  );
}
