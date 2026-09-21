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
  const lotRaw=String(first(params.lot)??'').slice(0,16);
  const lotIndex=/^\d{1,4}$/.test(lotRaw)?Number(lotRaw):null;
  const c=locale==='ru'
    ?{e:'Рынок',t:'Рынок',p:'Показываем только опубликованные обезличенные лоты. Данные продавца, внутренние идентификаторы и закрытые условия остаются скрыты.',search:'Культура, класс или регион',filters:'Фильтры',path:'Путь лота в Сделке'}
    :locale==='en'
      ?{e:'Market',t:'Public lots',p:'We show only published anonymised lots. Seller identity, internal identifiers and private terms remain hidden.',search:'Crop, grade or region',filters:'Filters',path:'Lot path through the Deal'}
      :{e:'市场',t:'公开批次',p:'只展示已发布的匿名批次。卖方身份、内部标识和非公开条件保持隐藏。',search:'作物、等级或地区',filters:'筛选',path:'批次在交易中的路径'};
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
        <form className='pc-cp-market-toolbar' action='/platform-v7/market' method='get' role='search'>
          <input type='hidden' name='lang' value={locale}/>
          <div style={{position:'relative'}}>
            <Search size={18} aria-hidden='true' style={{position:'absolute',left:14,top:15,color:'var(--pc-cp-muted)'}}/>
            <input className='pc-cp-search' style={{paddingLeft:42}} name='q' defaultValue={query} placeholder={c.search} aria-label={c.search}/>
          </div>
          <button className='pc-cp-button pc-cp-button--secondary' type='submit'><SlidersHorizontal size={16} aria-hidden='true'/>{c.filters}</button>
        </form>
        <CanonicalMarketResults locale={locale} query={query} selectedIndex={null}/>
      </div>
    </section>
    <section className='pc-cp-section pc-cp-section--tight'>
      <div className='pc-cp-container'><div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.path}</span></div><CanonicalDealSpine locale={locale} currentIndex={0}/></div>
    </section>
    <CanonicalFooter locale={locale}/>
    <CanonicalBottomNav locale={locale} active='/platform-v7/market'/>
  </main>;
}
