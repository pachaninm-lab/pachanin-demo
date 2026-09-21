import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { canonicalPublicLocale } from '@/components/platform-v7/PublicCanonicalPrimitives';
import PublicGektaPage from '../ai-in-action/page';

const META={"ru":["Гекта — Прозрачная Цена","Гекта помогает разобраться в Сделке по доступным участнику данным: показывает факты, риски, документы и доступные действия."],"en":["Gekta — Transparent Price","Gekta helps participants understand a Deal from the data they are allowed to see: facts, risks, documents and available actions."],"zh":["Gekta — 透明价格","Gekta 在可用事实和权限范围内解释交易上下文、文件、物流、质量、结算、风险和允许的下一步。"]} as const;

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
