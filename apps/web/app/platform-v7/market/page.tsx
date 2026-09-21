import '@/styles/platform-v7-canonical-public-v1.css';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { Search, SlidersHorizontal } from 'lucide-react';
import {
  CanonicalBottomNav,
  CanonicalDealSpine,
  CanonicalFooter,
  CanonicalPublicHeader,
  canonicalPublicLocale,
} from '@/components/platform-v7/PublicCanonicalPrimitives';
import { CanonicalMarketResults, CanonicalPublicLotView } from '@/components/platform-v7/PublicCanonicalMarket';

type Params=Record<string,string|string[]|undefined>;
const first=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;

const META={"ru":["Рынок — Прозрачная Цена","Публичный обезличенный рынок лотов, которые сервер разрешил к публикации."],"en":["Market — Transparent Price","Public anonymised lots admitted by the server for publication, without seller identity or private terms."],"zh":["市场 — 透明价格","服务器允许公开的匿名批次市场，不披露卖方身份、内部标识或非公开条件。"]} as const;


const CROP_OPTIONS={
  ru:[['','Все культуры'],['wheat','Пшеница'],['barley','Ячмень'],['corn','Кукуруза'],['sunflower','Подсолнечник'],['soybean','Соя'],['rapeseed','Рапс'],['rye','Рожь'],['oats','Овёс']],
  en:[['','All crops'],['wheat','Wheat'],['barley','Barley'],['corn','Corn'],['sunflower','Sunflower'],['soybean','Soybean'],['rapeseed','Rapeseed'],['rye','Rye'],['oats','Oats']],
  zh:[['','全部作物'],['wheat','小麦'],['barley','大麦'],['corn','玉米'],['sunflower','向日葵'],['soybean','大豆'],['rapeseed','油菜籽'],['rye','黑麦'],['oats','燕麦']],
} as const;

export async function generateMetadata():Promise<Metadata>{
  const locale=canonicalPublicLocale(await getLocale());
  const copy=META[locale];
  return {
    title:copy[0],
    description:copy[1],
    alternates:{
      canonical:'/platform-v7/market',
      languages:{
        ru:'/platform-v7/market?lang=ru',
        en:'/platform-v7/market?lang=en',
        zh:'/platform-v7/market?lang=zh',
      },
    },
    robots:{index:true,follow:true},
  };
}

export default async function PlatformV7MarketPage({searchParams}:{searchParams?:Promise<Params>}){
  const params=(await searchParams)??{};
  const locale=canonicalPublicLocale(first(params.lang)??await getLocale());
  const query=String(first(params.q)??'').slice(0,120);
  const crop=String(first(params.crop)??'').slice(0,32);
  const region=String(first(params.region)??'').slice(0,80);
  const grade=String(first(params.grade)??'').slice(0,80);
  const lotRaw=String(first(params.lot)??'').slice(0,16);
  const lotIndex=/^\d{1,4}$/.test(lotRaw)?Number(lotRaw):null;
  const c=locale==='ru'
    ?{e:'Рынок',t:'Рынок',p:'Опубликованные обезличенные лоты. Личность продавца, внутренние идентификаторы и закрытые условия не раскрываются.',search:'Культура, класс или регион',filters:'Фильтры',crop:'Культура',region:'Регион',regionHint:'Например, Тамбовская область',grade:'Класс / сорт',gradeHint:'Например, 3 класс',apply:'Применить',reset:'Сбросить',path:'Путь лота в Сделке'}
    :locale==='en'
      ?{e:'Market',t:'Public lots',p:'Only real anonymised data admitted by the server for publication. Seller identity, internal identifiers and private terms are not disclosed.',search:'Crop, grade or region',filters:'Filters',crop:'Crop',region:'Region',regionHint:'For example, Tambov Region',grade:'Grade',gradeHint:'For example, grade 3',apply:'Apply',reset:'Reset',path:'Lot path through the Deal'}
      :{e:'市场',t:'公开批次',p:'仅展示服务器允许公开的真实匿名数据。卖方身份、内部标识和非公开条件不会披露。',search:'作物、等级或地区',filters:'筛选',crop:'作物',region:'地区',regionHint:'例如：坦波夫州',grade:'等级',gradeHint:'例如：3 级',apply:'应用',reset:'重置',path:'批次在交易中的路径'};
  if(lotIndex!==null){
    return <main className='pc-canonical-public pc-cp-page-market'>
      <CanonicalPublicHeader locale={locale} activePath='/platform-v7/market'/>
      <section className='pc-cp-lot-hero'><div className='pc-cp-container'><CanonicalPublicLotView locale={locale} lotIndex={lotIndex}/></div></section>
      <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'><div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.path}</span><h2>{locale==='ru'?'Лот — первый этап одной Сделки':locale==='en'?'The lot is the first stage of one Deal':'批次是一笔交易的第一阶段'}</h2></div><CanonicalDealSpine locale={locale} currentIndex={0}/></div></section>
      <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale} active='/platform-v7/market'/>
    </main>;
  }
  return <main className='pc-canonical-public pc-cp-page-market'>
    <CanonicalPublicHeader locale={locale} activePath='/platform-v7/market'/>
    <section className='pc-cp-market-hero'>
      <div className='pc-cp-container'>
        <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.e}</span><h1>{c.t}</h1><p>{c.p}</p></div>
      </div>
    </section>
    <section className='pc-cp-section pc-cp-section--tight'>
      <div className='pc-cp-container'>
        <form className='pc-cp-market-toolbar pc-cp-market-toolbar--filters' action='/platform-v7/market' method='get' role='search'>
          <input type='hidden' name='lang' value={locale}/>
          <label className='pc-cp-market-field pc-cp-market-field--search'>
            <span>{c.search}</span>
            <span className='pc-cp-market-search-control'><Search size={18} aria-hidden='true'/><input className='pc-cp-search' name='q' defaultValue={query} placeholder={c.search}/></span>
          </label>
          <div className='pc-cp-market-filter-grid' role='group' aria-label={c.filters}>
            <label className='pc-cp-market-field'><span>{c.crop}</span><select name='crop' defaultValue={crop}>{CROP_OPTIONS[locale].map(([value,label])=><option value={value} key={value||'all'}>{label}</option>)}</select></label>
            <label className='pc-cp-market-field'><span>{c.region}</span><input name='region' defaultValue={region} placeholder={c.regionHint}/></label>
            <label className='pc-cp-market-field'><span>{c.grade}</span><input name='grade' defaultValue={grade} placeholder={c.gradeHint}/></label>
          </div>
          <div className='pc-cp-market-filter-actions'>
            <button className='pc-cp-button' type='submit'><SlidersHorizontal size={16} aria-hidden='true'/>{c.apply}</button>
            <a className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/market?lang=${locale}`}>{c.reset}</a>
          </div>
        </form>
        <CanonicalMarketResults locale={locale} query={query} filters={{crop,region,grade}} selectedIndex={null}/>
      </div>
    </section>
    <section className='pc-cp-section pc-cp-section--tight'>
      <div className='pc-cp-container'><div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.path}</span></div><CanonicalDealSpine locale={locale} currentIndex={0}/></div>
    </section>
    <CanonicalFooter locale={locale}/>
    <CanonicalBottomNav locale={locale} active='/platform-v7/market'/>
  </main>;
}
