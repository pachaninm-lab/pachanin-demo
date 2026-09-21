import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { canonicalPublicLocale } from '@/components/platform-v7/PublicCanonicalPrimitives';
import PublicGektaPage from '../ai-in-action/page';

const META={"ru":["Гекта — Прозрачная Цена","Гекта объясняет контекст Сделки, документы, логистику, качество, расчёт, риски и допустимый следующий шаг в пределах доступных фактов и полномочий."],"en":["Gekta — Transparent Price","Gekta explains Deal context, documents, logistics, quality, settlement, risks and the next permitted step within available facts and authority."],"zh":["Gekta — 透明价格","Gekta 在可用事实和权限范围内解释交易上下文、文件、物流、质量、结算、风险和允许的下一步。"]} as const;

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
