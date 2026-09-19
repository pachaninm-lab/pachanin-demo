import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';

type Locale = 'ru' | 'en' | 'zh';
type Copy = { title: string; lead: string; blocks: readonly (readonly [string, string])[]; terms: string; privacy: string; contact: string };
const COPY: Record<Locale, Copy> = {
  ru: {
    title: 'Условия сервиса',
    lead: 'Информация о цифровом сервисе и границах ответственности. Этот раздел не заменяет договор сторон и не является офертой от имени неподтверждённого оператора.',
    blocks: [
      ['Назначение сервиса', 'Платформа связывает организацию, участников, условия, документы и события исполнения одной агросделки. Условия цифрового сервиса не заменяют обязательства сторон по их договору.'],
      ['Внешние действия', 'Запрос в банк, государственную систему или сервис документов не является подтверждением результата. Необходимое основание и ответ соответствующей организации рассматриваются отдельно.'],
      ['Обязанности пользователя', 'Указывайте достоверные сведения, действуйте в пределах предоставленных полномочий, не искажайте документы и не обходите проверки. Публичный выбор роли не предоставляет доступ.'],
      ['Границы ответственности', 'Платформа не заменяет правовую экспертизу, банковское решение, подтверждение государственного органа, внутренние процедуры сторон или их договорные обязательства.'],
      ['Реквизиты и договор', 'Официальная оферта или иной юридически значимый договор от имени конкретного оператора сервиса может публиковаться только после подтверждения его реквизитов официальными документами. Неподтверждённые наименование, ИНН, ОГРН и адрес не подставляются автоматически.'],
    ],
    terms: 'Условия использования', privacy: 'Политика конфиденциальности', contact: 'Задать вопрос',
  },
  en: {
    title: 'Service information',
    lead: 'Information about the digital service and responsibility boundaries. This section does not replace the parties’ contract and is not an offer made on behalf of an unverified operator.',
    blocks: [
      ['Service purpose', 'The platform connects an organisation, participants, terms, documents and execution events around one agricultural Deal. Digital service information does not replace the parties’ contractual obligations.'],
      ['External actions', 'A request to a bank, government system or document service is not confirmation of a result. The required grounds and response from the relevant organisation are considered separately.'],
      ['User responsibilities', 'Provide accurate information, act within granted authority, do not falsify documents or bypass checks. Choosing a role on a public page does not grant access.'],
      ['Responsibility boundaries', 'The platform does not replace legal expertise, a bank decision, government confirmation, internal party procedures or contractual obligations.'],
      ['Operator details and contract', 'An official offer or other binding contract on behalf of an operator requires that operator’s details to be supported by official documents. An unverified name, tax number, registration number or address is not inserted automatically.'],
    ],
    terms: 'Terms of use', privacy: 'Privacy policy', contact: 'Ask a question',
  },
  zh: {
    title: '服务说明',
    lead: '关于数字服务和责任边界的信息。本节不替代交易双方的合同，也不代表未经核实的运营方提出合同要约。',
    blocks: [
      ['服务用途', '平台围绕同一笔农业交易连接机构、参与方、条件、文件和履约事件。数字服务说明不替代交易双方的合同义务。'],
      ['外部操作', '向银行、政府系统或文件服务发出请求不等于结果确认。所需依据与相关机构的答复必须分别核对。'],
      ['用户责任', '请提供真实信息，在授权范围内操作，不伪造文件、不绕过检查。在公开页面选择角色不会授予访问权限。'],
      ['责任边界', '平台不替代法律审查、银行决定、政府确认、双方内部程序或合同义务。'],
      ['运营方信息与合同', '以具体运营方名义发布正式要约或其他具有约束力的合同，需要官方文件支持该运营方的信息。未经核实的名称、税号、注册号或地址不会被自动填入。'],
    ],
    terms: '使用条款', privacy: '隐私政策', contact: '提出问题',
  },
};
function localeOf(value: string): Locale { return value.startsWith('en') ? 'en' : value.startsWith('zh') ? 'zh' : 'ru'; }
export async function generateMetadata(): Promise<Metadata> {
  const locale = localeOf(await getLocale()); const copy = COPY[locale];
  return { title: copy.title, description: copy.lead, alternates: { canonical: '/platform-v7/oferta', languages: { ru: '/platform-v7/oferta?lang=ru', en: '/platform-v7/oferta?lang=en', zh: '/platform-v7/oferta?lang=zh' } }, robots: { index: false, follow: true } };
}
export default async function OfertaPage() {
  const locale = localeOf(await getLocale()); const copy = COPY[locale]; const suffix = `?lang=${locale}`;
  return <main className='pc-linked-info' data-testid='platform-v7-public-oferta-page'>
    <section className='pc-linked-hero'><h1>{copy.title}</h1><p>{copy.lead}</p></section>
    {copy.blocks.map(([title, text]) => <section key={title} className='pc-linked-card'><h2>{title}</h2><p>{text}</p></section>)}
    <nav className='pc-linked-actions' aria-label={copy.title}><Link href={`/platform-v7/terms${suffix}`}>{copy.terms}</Link><Link href={`/platform-v7/privacy${suffix}`}>{copy.privacy}</Link><Link href={`/platform-v7/contact${suffix}`}>{copy.contact}</Link></nav>
  </main>;
}
