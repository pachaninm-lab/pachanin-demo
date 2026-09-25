import '@/styles/platform-v7-canonical-public-v1.css';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { Search, SlidersHorizontal } from 'lucide-react';
import {
  CanonicalBottomNav, CanonicalDealSpine, CanonicalFooter,
  CanonicalPublicHeader, canonicalPublicLocale,
} from '@/components/platform-v7/PublicCanonicalPrimitives';
import { CanonicalCropCatalogue, CanonicalMarketResults, CanonicalPublicLotView } from '@/components/platform-v7/PublicCanonicalMarket';
import { PublicMarketOffersAnchor } from '@/components/platform-v7/PublicMarketOffersAnchor';
import { marketHref, publicLotReference, publicMarketContext } from '@/lib/platform-v7/public-market-navigation';

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const META={"ru":["Рынок продукции растениеводства — Прозрачная Цена","Предложения по продаже и закупке продукции растениеводства. Поиск по культуре, классу и региону, сравнение опубликованных условий."],"en":["Crop market — Transparent Price","Crop offers for sale and purchase. Search by crop, grade and region and compare published terms."],"zh":["农产品市场 — 透明价格","查看农产品供求信息，按作物、等级和地区搜索，并比较已发布的条件。"]} as const;
const CROP_OPTIONS = {
  ru:[['','Все культуры'],['wheat','Пшеница'],['barley','Ячмень'],['corn','Кукуруза'],['sunflower','Подсолнечник'],['soybean','Соя'],['rapeseed','Рапс'],['rye','Рожь'],['oats','Овёс']],
  en:[['','All crops'],['wheat','Wheat'],['barley','Barley'],['corn','Corn'],['sunflower','Sunflower'],['soybean','Soybean'],['rapeseed','Rapeseed'],['rye','Rye'],['oats','Oats']],
  zh:[['','全部作物'],['wheat','小麦'],['barley','大麦'],['corn','玉米'],['sunflower','向日葵'],['soybean','大豆'],['rapeseed','油菜籽'],['rye','黑麦'],['oats','燕麦']],
} as const;
const SORT_OPTIONS = {
  ru:[['','По публикации'],['closing','Сначала закрывающиеся'],['price-asc','Цена: сначала ниже'],['price-desc','Цена: сначала выше'],['volume-desc','Объём: сначала больше']],
  en:[['','Published order'],['closing','Closing soonest'],['price-asc','Price: low to high'],['price-desc','Price: high to low'],['volume-desc','Volume: high to low']],
  zh:[['','按发布顺序'],['closing','即将截止优先'],['price-asc','价格：从低到高'],['price-desc','价格：从高到低'],['volume-desc','数量：从高到低']],
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = canonicalPublicLocale(await getLocale());
  const copy = META[locale];
  return { title:copy[0], description:copy[1], alternates:{
    canonical:'/platform-v7/market', languages:{
      ru:'/platform-v7/market?lang=ru', en:'/platform-v7/market?lang=en', zh:'/platform-v7/market?lang=zh',
    },
  }, robots:{index:true,follow:true} };
}

export default async function PlatformV7MarketPage({ searchParams }: { searchParams?: Promise<Params> }) {
  const params = (await searchParams) ?? {};
  const locale = canonicalPublicLocale(first(params.lang) ?? await getLocale());
  const context = publicMarketContext(params);
  const { q: query, crop, region, grade, sort } = context;
  // An explicitly supplied numeric, empty, duplicated or malformed lot is an invalid link,
  // not permission to silently open a different result from the current list.
  const hasLotParameter = params.lot !== undefined;
  const lotRef = publicLotReference(params.lot);
  const c = locale === 'ru'
    ? {e:'Продажа и закупка',t:'Рынок продукции растениеводства',p:'Выберите культуру для продажи или закупки. Опубликованные предложения можно отобрать по региону и классу, а затем отсортировать по цене.',offers:'Опубликованные предложения',jump:'К предложениям',search:'Культура, класс или регион',query:'Поиск',filters:'Фильтры',activeFilters:'Применённые фильтры',crop:'Культура',region:'Регион',regionHint:'Например, Тамбовская область',grade:'Класс / сорт',gradeHint:'Например, 3 класс',sort:'Сортировка',apply:'Применить',reset:'Сбросить фильтры',remove:'Убрать фильтр',path:'От лота до завершения сделки'}
    : locale === 'en'
      ? {e:'Sale and purchase',t:'Crop market',p:'Choose a crop to sell or buy. Filter published offers by region and grade, then sort them by price.',offers:'Published offers',jump:'Go to offers',search:'Crop, grade or region',query:'Search',filters:'Filters',activeFilters:'Applied filters',crop:'Crop',region:'Region',regionHint:'For example, Tambov Region',grade:'Grade',gradeHint:'For example, grade 3',sort:'Sort',apply:'Apply',reset:'Reset filters',remove:'Remove filter',path:'From a lot to a completed Deal'}
      : {e:'销售与采购',t:'农产品市场',p:'选择要销售或采购的作物，先按地区和等级筛选已发布的供求信息，再按价格排序。',offers:'已发布的供求信息',jump:'查看供求信息',search:'作物、等级或地区',query:'搜索',filters:'筛选',activeFilters:'已应用筛选',crop:'作物',region:'地区',regionHint:'例如：坦波夫州',grade:'等级',gradeHint:'例如：3 级',sort:'排序',apply:'应用',reset:'重置筛选',remove:'移除筛选',path:'从批次到交易完成'};
  const cropLabel = CROP_OPTIONS[locale].find(([value]) => value === crop)?.[1] ?? crop;
  const sortLabel = SORT_OPTIONS[locale].find(([value]) => value === sort)?.[1] ?? sort;
  const chips = [
    ['q', c.query, query], ['crop', c.crop, crop ? cropLabel : ''], ['region', c.region, region],
    ['grade', c.grade, grade], ['sort', c.sort, sort ? sortLabel : ''],
  ] as const;
  if (hasLotParameter) {
    return <main className='pc-canonical-public pc-cp-page-market'>
      <CanonicalPublicHeader locale={locale} activePath='/platform-v7/market' />
      <section className='pc-cp-lot-hero'><div className='pc-cp-container'><CanonicalPublicLotView locale={locale} lotRef={lotRef} context={context} /></div></section>
      <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'><div className='pc-cp-section-head'><h2>{c.path}</h2></div><CanonicalDealSpine locale={locale} currentIndex={null} /></div></section>
      <CanonicalFooter locale={locale} /><CanonicalBottomNav locale={locale} active='/platform-v7/market' />
    </main>;
  }
  return <main className='pc-canonical-public pc-cp-page-market'>
    <CanonicalPublicHeader locale={locale} activePath='/platform-v7/market' />
    <section className='pc-cp-market-hero'><div className='pc-cp-container'><div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.e}</span><h1>{c.t}</h1><p>{c.p}</p><a className='pc-cp-button pc-cp-button--secondary pc-cp-market-jump' href='#offers'>{c.jump}</a></div></div></section>
    <section className='pc-cp-section pc-cp-section--tight'><div className='pc-cp-container'><CanonicalCropCatalogue locale={locale} context={context} offersAnchor /></div></section>
    <section className='pc-cp-section pc-cp-section--tight' id='offers' tabIndex={-1} aria-labelledby='pc-market-offers-title'>
      <PublicMarketOffersAnchor />
      <div className='pc-cp-container'>
        <div className='pc-cp-section-head'><h2 id='pc-market-offers-title'>{c.offers}</h2></div>
        <form className='pc-cp-market-toolbar pc-cp-market-toolbar--filters' action='/platform-v7/market#offers' method='get' role='search' aria-label={c.filters}>
          <input type='hidden' name='lang' value={locale} />
          <label className='pc-cp-market-field pc-cp-market-field--search'><span>{c.search}</span><span className='pc-cp-market-search-control'><Search size={18} aria-hidden='true' /><input className='pc-cp-search' type='search' name='q' defaultValue={query} placeholder={c.search} maxLength={120} /></span></label>
          <div className='pc-cp-market-filter-grid' role='group' aria-label={c.filters}>
            <label className='pc-cp-market-field'><span>{c.crop}</span><select name='crop' defaultValue={crop}>{CROP_OPTIONS[locale].map(([value,label]) => <option value={value} key={value || 'all'}>{label}</option>)}</select></label>
            <label className='pc-cp-market-field'><span>{c.region}</span><input name='region' defaultValue={region} placeholder={c.regionHint} maxLength={80} /></label>
            <label className='pc-cp-market-field'><span>{c.grade}</span><input name='grade' defaultValue={grade} placeholder={c.gradeHint} maxLength={80} /></label>
            <label className='pc-cp-market-field'><span>{c.sort}</span><select name='sort' defaultValue={sort}>{SORT_OPTIONS[locale].map(([value,label]) => <option value={value} key={value || 'default'}>{label}</option>)}</select></label>
          </div>
          <div className='pc-cp-market-filter-actions'><button className='pc-cp-button' type='submit'><SlidersHorizontal size={16} aria-hidden='true' />{c.apply}</button><a className='pc-cp-button pc-cp-button--secondary' href={`${marketHref(locale, publicMarketContext())}#offers`}>{c.reset}</a></div>
          {chips.some(([, , value]) => Boolean(value)) ? <div className='pc-cp-market-active-filters' aria-label={c.activeFilters}>
            {chips.filter(([, , value]) => Boolean(value)).map(([key, label, value]) => <a key={key} href={`${marketHref(locale, publicMarketContext({ ...context, [key]: '' }))}#offers`} aria-label={`${c.remove}: ${label} — ${value}`}><strong>{label}</strong><span>{value}</span><span aria-hidden='true'>×</span></a>)}
          </div> : null}
        </form>
        <CanonicalMarketResults locale={locale} query={query} filters={{crop,region,grade}} sort={sort} selectedRef={null} />
      </div>
    </section>
    <section className='pc-cp-section pc-cp-section--tight'><div className='pc-cp-container'><div className='pc-cp-section-head'><h2>{c.path}</h2></div><CanonicalDealSpine locale={locale} currentIndex={null} /></div></section>
    <CanonicalFooter locale={locale} /><CanonicalBottomNav locale={locale} active='/platform-v7/market' />
  </main>;
}
