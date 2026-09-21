import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { canonicalPublicLocale } from '@/components/platform-v7/PublicCanonicalPrimitives';
import PublicGektaPage from '../ai-in-action/page';

const META={"ru":["Гекта — Прозрачная Цена","Гекта работает с данными Сделки, доступными участнику: документами, логистикой, качеством, расчётом и рисками, и показывает действия, разрешённые его роли."],"en":["Gekta — Transparent Price","Gekta works with Deal data available to the participant — documents, logistics, quality, settlement and risk — and shows the actions available to that role."],"zh":["Gekta — 透明价格","Gekta 根据参与方可访问的交易数据说明文件、物流、质量、结算和风险，并显示该角色可执行的操作。"]} as const;

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
