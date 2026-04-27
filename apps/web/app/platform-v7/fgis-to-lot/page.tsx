import Link from 'next/link';
import { PLATFORM_V7_MARKET_RFQ_ROUTE } from '@/lib/platform-v7/routes';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const WARN = '#B45309';
const ERR = '#B91C1C';

const steps = [
  ['1', 'Права доступа', 'Проверить организацию продавца, роль пользователя, КЭП/МЧД и право видеть партии ФГИС.'],
  ['2', 'Список партий', 'Получить партии с номером, статусом, доступной массой, местом хранения и датой изменения.'],
  ['3', 'Паспорт партии', 'Собрать культуру, год урожая, назначение, качество, остаток, собственника и место хранения.'],
  ['4', 'Проверка допуска', 'Не выпускать лот, если партия заблокирована, аннулирована, без остатка, без качества или с карантинным признаком.'],
  ['5', 'Черновик лота', 'Сформировать лот только из доступного остатка, с неизменяемыми полями из ФГИС и ручными коммерческими полями.'],
  ['6', 'Публикация', 'Показать лот покупателям только после подтверждения продавца и фиксации источника данных.'],
];

const fgisFields = [
  ['Номер партии', 'number / lotNumber', 'Основной ключ сопоставления партии и будущего лота'],
  ['Статус партии', 'status', 'Нельзя публиковать аннулированную, архивную или заблокированную партию'],
  ['Исходная масса', 'amountOriginal', 'Нужна для контроля происхождения и сверки объёма'],
  ['Доступная масса', 'amountAvailable', 'Максимальный объём, который можно выставить в лот'],
  ['Дата регистрации', 'dateRegistration', 'Фиксирует момент появления партии в системе'],
  ['Дата изменения', 'lastModified', 'Нужна для повторной сверки перед сделкой'],
  ['Культура', 'Crop', 'Что именно продаётся'],
  ['Год урожая', 'HarvestYear', 'Ключевой коммерческий и качественный параметр'],
  ['Место хранения', 'StoragePlace', 'Базис логистики и самовывоза'],
  ['Показатели качества', 'ListValueQualityIndicator', 'Класс, влажность, сорность, клейковина и другие признаки'],
  ['Собственник', 'Owner', 'Кто вправе выставлять товар'],
  ['Хранитель', 'Repository', 'Где фактически лежит партия, если есть хранение'],
];

const sample = {
  lot: 'ФГИС-68-2403-001', crop: 'Пшеница 4 класса', amount: '1 200 т', available: '1 050 т', year: '2025', storage: 'Тамбовская область · элеватор', owner: 'КФХ «Северное поле»', status: 'Подписана', quality: ['влажность 12,8%', 'сорная примесь 1,7%', 'клейковина 23%', 'протеин 12,1%'],
};

export default function PlatformV7FgisToLotPage() {
  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>ФГИС → лот · песочница</div>
            <div style={{ marginTop: 6, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: T }}>Как партия из ФГИС становится лотом</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 940 }}>
              В жизни нельзя просто скопировать товар и показать его покупателю. Сначала нужно подтвердить права продавца, остаток партии, качество, статус, место хранения и блокеры. Только после этого создаётся черновик лота.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/seller/fgis-parties' style={btn()}>Партии ФГИС</Link>
            <Link href={PLATFORM_V7_MARKET_RFQ_ROUTE} style={btn('primary')}>Рынок и заявки</Link>
          </div>
        </div>
      </section>

      <section style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Правило безопасности</div>
        <div style={{ marginTop: 6, fontSize: 13, color: T, lineHeight: 1.55 }}>
          Лот публикуется не из ручного ввода, а из паспорта партии. Поля ФГИС защищены от редактирования. Продавец может менять только коммерческие условия: цену, минимальный объём, срок поставки, условия оплаты и комментарий.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        <Metric label='Партия ФГИС' value={sample.lot} tone='good' />
        <Metric label='Доступно к лоту' value={sample.available} tone='good' />
        <Metric label='Статус' value={sample.status} tone='good' />
      </div>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Жизненный сценарий</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
          {steps.map(([num, title, note]) => (
            <div key={num} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: 'rgba(10,122,95,0.10)', color: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>{num}</div>
              <div style={{ marginTop: 10, fontSize: 15, fontWeight: 900, color: T }}>{title}</div>
              <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: M }}>{note}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Паспорт партии</div>
        <div style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: T }}>{sample.crop} · {sample.year}</div>
          <div style={{ fontSize: 13, color: M }}>{sample.owner} · {sample.storage}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 8 }}>
            <Cell label='Исходная масса' value={sample.amount} />
            <Cell label='Доступная масса' value={sample.available} />
            <Cell label='Статус партии' value={sample.status} />
            <Cell label='Источник' value='ФГИС' />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {sample.quality.map((item) => <span key={item} style={{ padding: '6px 9px', borderRadius: 999, background: '#fff', border: `1px solid ${B}`, color: T, fontSize: 12, fontWeight: 800 }}>{item}</span>)}
          </div>
        </div>
      </section>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Какие данные подтягиваем</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {fgisFields.map(([label, source, why]) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 0.8fr) minmax(140px, 0.8fr) minmax(220px, 1.4fr)', gap: 10, background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: T }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: BRAND }}>{source}</div>
              <div style={{ fontSize: 12, color: M, lineHeight: 1.45 }}>{why}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Блокеры публикации лота</div>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {['Нет права продавца на партию', 'Партия аннулирована или в архиве', 'Доступная масса равна нулю', 'Партия уже указана в СДИЗ и заблокирована', 'Нет обязательных показателей качества', 'Место хранения не совпадает с логистическим базисом', 'Дата последнего изменения свежее черновика лота'].map((item) => (
            <div key={item} style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.16)', borderRadius: 12, padding: 10, color: ERR, fontSize: 13, fontWeight: 800 }}>{item}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' }) {
  return (
    <div style={{ background: tone === 'good' ? 'rgba(10,122,95,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${tone === 'good' ? 'rgba(10,122,95,0.18)' : 'rgba(220,38,38,0.18)'}`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 900, color: BRAND, lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${B}`, borderRadius: 12, padding: 10, background: S }}>
      <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 5, fontSize: 13, fontWeight: 900, color: T }}>{value}</div>
    </div>
  );
}

function btn(kind: 'default' | 'primary' = 'default') {
  return {
    textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: kind === 'primary' ? 'rgba(10,122,95,0.08)' : SS,
    border: `1px solid ${kind === 'primary' ? 'rgba(10,122,95,0.18)' : B}`, color: kind === 'primary' ? BRAND : T, fontSize: 13, fontWeight: 800,
  };
}
