import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { ArrowRight, FileCheck2, Truck, Scale, ShieldCheck, Landmark, ClipboardCheck } from 'lucide-react';

type Locale = 'ru' | 'en' | 'zh';
type Layer = readonly [string, string];
type Copy = { title: string; lead: string; layersTitle: string; layers: readonly [Layer, Layer, Layer, Layer, Layer, Layer]; boundaryTitle: string; boundary: string; register: string; how: string };
const COPY: Record<Locale, Copy> = {
  ru: {
    title: 'Документы связывают условия, исполнение и расчёт',
    lead: 'У одной агросделки — связанная история документов: от согласованных условий до поставки, качества, расчёта и закрытия. Участник понимает, к какой партии и действию относится каждый материал.',
    layersTitle: 'Шесть задач документного сопровождения',
    layers: [
      ['Документы партии и ЭДО', 'Партия, договор и документы соотносятся между собой. СДИЗ применяется там, где этого требует соответствующая операция.'],
      ['Транспортные документы', 'Рейс, маршрут и факты передачи груза дают основу для сверки документов перевозки.'],
      ['Акты и приёмка', 'Факты поставки, вес и расхождения рассматриваются вместе с согласованными условиями.'],
      ['Качество', 'Проба, методика и протокол остаются связаны с конкретной партией и результатом исследования.'],
      ['Основание расчёта', 'Условия, фактическое исполнение, услуги и документы объясняют структуру итоговой суммы.'],
      ['Разногласия и доказательства', 'Материалы и история решений помогают восстановить основание изменения или спорного действия.'],
    ],
    boundaryTitle: 'Кто отвечает за документ и действие',
    boundary: 'Документ создаёт или подтверждает участник в пределах своих полномочий. ФГИС, ЭДО, 1С и банк сохраняют собственные правила и ответственность. Обмен с ними требует отдельного основания, доступа и адаптера; публичная страница не подписывает и не отправляет документы.',
    register: 'Зарегистрироваться', how: 'Посмотреть путь Сделки',
  },
  en: {
    title: 'Documents connect terms, execution and settlement',
    lead: 'One agricultural Deal keeps a connected document history, from agreed terms through delivery, quality, settlement and closure. Each participant can understand which lot and action a record belongs to.',
    layersTitle: 'Six document-management tasks',
    layers: [
      ['Lot documents and electronic exchange', 'The lot, contract and documents stay related. The grain traceability document applies where the particular operation requires it.'],
      ['Transport documents', 'The trip, route and cargo handover facts form the basis for reconciling transport records.'],
      ['Acts and acceptance', 'Delivery facts, weight and differences are considered together with the agreed terms.'],
      ['Quality', 'The sample, method and report remain linked to the specific lot and test result.'],
      ['Settlement basis', 'Terms, execution facts, services and documents explain how the final amount is formed.'],
      ['Disagreements and evidence', 'Materials and decision history help reconstruct the grounds for a change or disputed action.'],
    ],
    boundaryTitle: 'Who owns the document and action',
    boundary: 'A participant creates or confirms a document within their authority. Government systems, electronic document services, 1C and banks retain their own rules and responsibility. Exchange requires a separate basis, access and adapter; this public page neither signs nor sends documents.',
    register: 'Register', how: 'Explore the Deal journey',
  },
  zh: {
    title: '文件连接约定条件、履约和结算',
    lead: '同一笔农业交易保留关联的文件历史，从约定条件到交付、质量、结算和关闭。参与方能够理解每份材料属于哪个批次和操作。',
    layersTitle: '文件管理的六项任务',
    layers: [
      ['批次文件与电子文件交换', '批次、合同和文件相互关联。具体操作需要粮食追溯文件时，按相应规则使用。'],
      ['运输文件', '运输任务、路线和货物交接事实构成核对运输文件的依据。'],
      ['验收记录', '交付事实、重量和差异与双方约定的条件一起核对。'],
      ['质量', '样品、方法和检测报告始终关联到具体批次和检测结果。'],
      ['结算依据', '条件、履约事实、服务和文件说明最终金额如何形成。'],
      ['分歧与证据', '材料和决定历史帮助还原变更或争议操作的依据。'],
    ],
    boundaryTitle: '谁负责文件与操作',
    boundary: '参与方在权限范围内创建或确认文件。政府系统、电子文件服务、1C 和银行保留各自规则和责任。数据交换需要独立依据、访问权限和适配层；此公开页面不会签署或发送文件。',
    register: '注册', how: '查看交易流程',
  },
};
const ICONS = [FileCheck2, Truck, ClipboardCheck, ShieldCheck, Landmark, Scale] as const;
function localeOf(value: string): Locale { return value.startsWith('en') ? 'en' : value.startsWith('zh') ? 'zh' : 'ru'; }
export async function generateMetadata(): Promise<Metadata> {
  const locale = localeOf(await getLocale()); const copy = COPY[locale];
  return { title: copy.title, description: copy.lead, alternates: { canonical: '/platform-v7/docs', languages: { ru: '/platform-v7/docs?lang=ru', en: '/platform-v7/docs?lang=en', zh: '/platform-v7/docs?lang=zh' } }, openGraph: { title: copy.title, description: copy.lead, url: '/platform-v7/docs', type: 'website', locale: locale === 'en' ? 'en_US' : locale === 'zh' ? 'zh_CN' : 'ru_RU' } };
}
export default async function PlatformV7DocsPage() {
  const locale = localeOf(await getLocale()); const copy = COPY[locale]; const suffix = `?lang=${locale}`;
  return <main className='pc-linked-info p7-docs-page' data-testid='platform-v7-public-docs-page'>
    <section className='pc-linked-hero' aria-labelledby='docs-title'><h1 id='docs-title'>{copy.title}</h1><p>{copy.lead}</p><div className='pc-linked-actions'><Link className='pc-linked-primary' href={`/platform-v7/register${suffix}`}>{copy.register}<ArrowRight size={18} aria-hidden='true' /></Link><Link href={`/platform-v7/how-it-works${suffix}`}>{copy.how}</Link></div></section>
    <section className='pc-linked-grid' aria-label={copy.layersTitle}>{copy.layers.map(([title, text], index) => { const Icon = ICONS[index]!; return <article key={title}><Icon size={24} aria-hidden='true' /><h2>{title}</h2><p>{text}</p></article>; })}</section>
    <section className='pc-linked-card' aria-labelledby='docs-boundary-title'><h2 id='docs-boundary-title'>{copy.boundaryTitle}</h2><p>{copy.boundary}</p></section>
  </main>;
}
