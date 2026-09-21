import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { canonicalPublicLocale } from '@/components/platform-v7/PublicCanonicalPrimitives';
import PublicGektaPage from '../ai-in-action/page';

const META={"ru":["Гекта — Прозрачная Цена","Гекта показывает доступные участнику факты Сделки и отмечает риски или неподтверждённые места перед следующим действием."],"en":["Gekta — Transparent Price","Gekta shows the Deal facts available to the participant and marks risks or missing confirmation before the next action."],"zh":["Gekta — 透明价格","Gekta 显示参与方可访问的交易事实，并标出风险或仍待确认的事项。"]} as const;

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
