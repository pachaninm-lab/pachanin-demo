import '@/styles/platform-v7-canonical-public-v1.css';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import {
  CanonicalBottomNav,
  CanonicalDealSpine,
  CanonicalFooter,
  CanonicalPublicHeader,
  canonicalPublicLocale,
} from '@/components/platform-v7/PublicCanonicalPrimitives';
import { CanonicalPublicLotDetail } from '@/components/platform-v7/PublicCanonicalMarket';

export const metadata:Metadata={
  title:'Лот — Прозрачная Цена',
  description:'Публичная обезличенная карточка лота. Закрытые данные доступны только участникам с подтверждёнными полномочиями.',
  robots:{index:true,follow:true},
};

export default async function PublicMarketLotPage({params}:{params:Promise<{publicRef:string}>}){
  const {publicRef}=await params;
  const locale=canonicalPublicLocale(await getLocale());
  return <main className='pc-canonical-public'>
    <CanonicalPublicHeader locale={locale} activePath='/platform-v7/market'/>
    <CanonicalPublicLotDetail locale={locale} publicRef={decodeURIComponent(publicRef)}/>
    <section className='pc-cp-section pc-cp-section--soft'>
      <div className='pc-cp-container'>
        <div className='pc-cp-section-head'>
          <span className='pc-cp-eyebrow'>{locale==='ru'?'Путь лота':locale==='en'?'Lot journey':'批次路径'}</span>
          <h2>{locale==='ru'?'Лот — только первый этап Сделки':locale==='en'?'The lot is only the first Deal stage':'批次只是交易的第一阶段'}</h2>
        </div>
        <CanonicalDealSpine locale={locale} currentIndex={0}/>
      </div>
    </section>
    <CanonicalFooter locale={locale}/>
    <CanonicalBottomNav locale={locale} active='/platform-v7/market'/>
  </main>;
}
