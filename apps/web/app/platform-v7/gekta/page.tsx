import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { canonicalPublicLocale } from '@/components/platform-v7/PublicCanonicalPrimitives';
import PublicGektaPage from '../ai-in-action/page';

const META={"ru":["Гекта — Прозрачная Цена","Гекта собирает доступные факты Сделки, подсвечивает риски и помогает понять, что проверить и что делать дальше."],"en":["Gekta — Transparent Price","Gekta pulls available Deal facts together, highlights risk and helps you see what to check and what to do next."],"zh":["Gekta — 透明价格","Gekta 汇总可用交易事实、提示风险，并帮助你看清需要核验什么以及下一步怎么做。"]} as const;

export async function generateMetadata():Promise<Metadata>{
  const locale=canonicalPublicLocale(await getLocale());
  const copy=META[locale];
  return {
    title:copy[0],
    description:copy[1],
    alternates:{
      canonical:'/platform-v7/gekta',
      languages:{
        ru:'/platform-v7/gekta?lang=ru',
        en:'/platform-v7/gekta?lang=en',
        zh:'/platform-v7/gekta?lang=zh',
      },
    },
    robots:{index:true,follow:true},
  };
}

export default PublicGektaPage;
