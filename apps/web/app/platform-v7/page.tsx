import '@/styles/platform-v7-canonical-home-v1.css';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { PlatformV7StrategicHome } from '@/components/platform-v7/PlatformV7StrategicHome';

type Locale = 'ru' | 'en' | 'zh';
const META: Record<Locale,{title:string;description:string}> = {
  ru:{title:'Прозрачная Цена — агросделка от лота до результата',description:'Рынок, торги, обязательства, доставка, приёмка, качество, документы, расчёт и закрытие связаны в одной Сделке.'},
  en:{title:'Transparent Price — the agricultural Deal from lot to outcome',description:'Market, trading, commitments, delivery, acceptance, quality, documents, settlement and closure remain connected in one Deal.'},
  zh:{title:'透明价格 — 从批次到结果的农业交易',description:'市场、交易、义务、交付、验收、质量、文件、结算和关闭保持在同一笔交易中。'},
};
function localeOf(value:string):Locale{if(value.startsWith('en'))return'en';if(value.startsWith('zh'))return'zh';return'ru';}

export async function generateMetadata():Promise<Metadata>{
  const locale=localeOf(await getLocale()); const copy=META[locale];
  return {
    title:copy.title,description:copy.description,
    alternates:{canonical:'/platform-v7',languages:{ru:'/platform-v7?lang=ru',en:'/platform-v7?lang=en',zh:'/platform-v7?lang=zh'}},
    robots:{index:true,follow:true,googleBot:{index:true,follow:true,'max-image-preview':'large','max-snippet':-1,'max-video-preview':-1}},
    openGraph:{type:'website',title:copy.title,description:copy.description,url:'/platform-v7',siteName:'Прозрачная Цена',locale:locale==='en'?'en_US':locale==='zh'?'zh_CN':'ru_RU'},
    twitter:{card:'summary_large_image',title:copy.title,description:copy.description},
  };
}

export default async function PlatformV7RootPage(){return <PlatformV7StrategicHome/>;}
