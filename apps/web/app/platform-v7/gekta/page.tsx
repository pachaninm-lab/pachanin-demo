import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { canonicalPublicLocale } from '@/components/platform-v7/PublicCanonicalPrimitives';
import PublicGektaPage from '../ai-in-action/page';

const META={"ru":["Гекта — Прозрачная Цена","Гекта помогает разобраться в Сделке: документах, логистике, качестве, расчёте и рисках. Показывает доступные варианты действий на основе данных и прав участника."],"en":["Gekta — Transparent Price","Gekta helps users understand the Deal: documents, logistics, quality, settlement and risk. It shows available options based on the data and authority the participant actually has."],"zh":["Gekta — 透明价格","Gekta 帮助用户理解交易中的文件、物流、质量、结算和风险，并根据参与方实际可用的数据与权限显示可执行选项。"]} as const;

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
