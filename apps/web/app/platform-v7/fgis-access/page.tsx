import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { AuctionAuthorityRoute, type AuctionAuthorityRouteProps } from '@/components/transaction-ux/AuctionAuthorityRoute';

type Locale = 'ru' | 'en' | 'zh';

type AccessCopy = Omit<AuctionAuthorityRouteProps, 'testId'> & {
  metadataTitle: string;
  metadataDescription: string;
};

const COPY: Record<Locale, AccessCopy> = {
  ru: {
    metadataTitle: 'Доступ к ФГИС Зерно',
    metadataDescription: 'Серверная проверка организации и полномочий до импорта партии без локальных лотов и СДИЗ.',
    eyebrow: 'Организация → полномочия → внешний доступ → импорт',
    title: 'Платформа подтверждает право действовать, а не принимает пароль ФГИС',
    description: 'Вход начинается с проверки организации и представителя. Лот, СДИЗ, владелец, масса и качество появляются только после ответа утверждённого внешнего адаптера и серверной сверки.',
    statusLabel: 'организация и доступ не подтверждены',
    statusTone: 'warning',
    priority: {
      title: 'Подтверди организацию через защищённый gov-ID flow',
      description: 'После callback сервер сверяет claims, ИНН/ОГРН, представителя, membership и право запрашивать конкретную партию. Клиентский экран не создаёт эти факты.',
      blocker: 'нет server-issued identity result и FGIS access grant',
      owner: 'организация + комплаенс + интеграционный сервис',
      impact: 'импорт лота и аукцион закрыты',
      result: 'аудируемое право на запрос партии без передачи пароля ФГИС',
    },
    facts: [
      { label: 'Идентификация', value: 'server callback', hint: 'claims проверяются на backend' },
      { label: 'Организация', value: 'ИНН/ОГРН + membership', hint: 'не из URL и не из localStorage' },
      { label: 'Право действовать', value: 'роль представителя', hint: 'руководитель, доверенность или утверждённый контур' },
      { label: 'Данные партии', value: 'только после adapter response', hint: 'с provenance, временем и source fingerprint' },
    ],
    boundary: 'Боевой доступ ФГИС, token exchange и получение данных партии не считаются подтверждёнными без договоров, credentials и runtime evidence. До этого экран не показывает вымышленные организацию, лот, СДИЗ или массу.',
    notice: {
      title: 'Что не передаётся платформе',
      body: 'Пользователь не вводит пароль ФГИС в интерфейсе платформы. Подтверждение организации запускается через защищённый внешний flow, а права и данные проверяются сервером.',
      tone: 'information',
    },
    primaryAction: { href: '/api/platform-v7/gov-id/start?flow=fgis', label: 'Подтвердить организацию для ФГИС' },
    secondaryAction: { href: '/platform-v7/auction/import', label: 'Требования к импорту' },
    stepsHeading: 'Путь доступа к партии',
    invariantsHeading: 'Защитные ограничения',
    steps: [
      { href: '/platform-v7/fgis-access', title: 'Организация', detail: 'Проверка identity claims, membership и права представителя.', status: 'текущий этап', tone: 'information' },
      { href: '/platform-v7/auction/import', title: 'Импорт партии', detail: 'Нормализованный server snapshot из утверждённого источника.', status: 'закрыто до доступа', tone: 'neutral' },
      { href: '/platform-v7/auction/admission', title: 'Допуск', detail: 'Серверная проверка лота, продавца и покупателей.', status: 'закрыто до импорта', tone: 'neutral' },
      { href: '/platform-v7/auction', title: 'Аукцион', detail: 'Ставки и winner lock только после всех проверок.', status: 'закрыто до допуска', tone: 'neutral' },
    ],
    invariants: [
      { title: 'Пароль ФГИС не собирается', detail: 'Платформа использует утверждённый внешний flow и серверные credentials, а не пользовательский пароль.', tone: 'critical' },
      { title: 'Claims не назначают бизнес-роль напрямую', detail: 'Организация и membership сверяются с PostgreSQL; роль не определяется URL или клиентом.', tone: 'warning' },
      { title: 'Данные партии имеют provenance', detail: 'Каждый lot snapshot хранит источник, время, fingerprint и связь с audit event.', tone: 'information' },
      { title: 'Отказ безопасен', detail: 'Ошибка внешнего контура не заменяется ручным статусом «подтверждено» и не открывает аукцион.', tone: 'critical' },
    ],
    labels: {
      blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат',
      nextAction: 'Следующее безопасное действие', prioritySection: 'Главная задача доступа', factsSection: 'Граница доверия',
    },
  },
  en: {
    metadataTitle: 'FGIS Grain access',
    metadataDescription: 'Server verification of organization and authority before lot import, without local lots or SDIZ data.',
    eyebrow: 'Organization → authority → external access → import',
    title: 'The platform verifies authority; it does not collect an FGIS password',
    description: 'The flow begins with organization and representative verification. Lot, SDIZ, owner, mass and quality appear only after an approved external adapter responds and the server validates the result.',
    statusLabel: 'organization and access are unconfirmed',
    statusTone: 'warning',
    priority: {
      title: 'Confirm the organization through the protected gov-ID flow',
      description: 'After callback, the server validates claims, tax identifiers, representative, membership and the right to request a specific lot. The client does not create those facts.',
      blocker: 'no server-issued identity result or FGIS access grant',
      owner: 'organization + compliance + integration service',
      impact: 'lot import and auction remain closed',
      result: 'auditable right to request a lot without sharing an FGIS password',
    },
    facts: [
      { label: 'Identity', value: 'server callback', hint: 'claims are validated on the backend' },
      { label: 'Organization', value: 'tax IDs + membership', hint: 'not from URL or localStorage' },
      { label: 'Authority', value: 'representative role', hint: 'director, power of attorney or approved contour' },
      { label: 'Lot data', value: 'adapter response only', hint: 'with provenance, time and source fingerprint' },
    ],
    boundary: 'Production FGIS access, token exchange and lot retrieval are not confirmed without contracts, credentials and runtime evidence. Until then, the screen shows no invented organization, lot, SDIZ or mass.',
    notice: {
      title: 'What the platform does not collect',
      body: 'The user does not enter an FGIS password in the platform. Organization verification starts through a protected external flow; rights and data are validated by the server.',
      tone: 'information',
    },
    primaryAction: { href: '/api/platform-v7/gov-id/start?flow=fgis', label: 'Confirm organization for FGIS' },
    secondaryAction: { href: '/platform-v7/auction/import', label: 'Import requirements' },
    stepsHeading: 'Access path to a lot',
    invariantsHeading: 'Security constraints',
    steps: [
      { href: '/platform-v7/fgis-access', title: 'Organization', detail: 'Validate identity claims, membership and representative authority.', status: 'current phase', tone: 'information' },
      { href: '/platform-v7/auction/import', title: 'Lot import', detail: 'Normalized server snapshot from an approved source.', status: 'closed until access', tone: 'neutral' },
      { href: '/platform-v7/auction/admission', title: 'Admission', detail: 'Server validation of lot, seller and buyers.', status: 'closed until import', tone: 'neutral' },
      { href: '/platform-v7/auction', title: 'Auction', detail: 'Bids and winner lock only after all checks.', status: 'closed until admission', tone: 'neutral' },
    ],
    invariants: [
      { title: 'No FGIS password collection', detail: 'The platform uses an approved external flow and server credentials, not the user’s password.', tone: 'critical' },
      { title: 'Claims do not assign a business role directly', detail: 'Organization and membership are checked against PostgreSQL; URL and client state do not define the role.', tone: 'warning' },
      { title: 'Lot data has provenance', detail: 'Each lot snapshot records source, time, fingerprint and a linked audit event.', tone: 'information' },
      { title: 'Failure is safe', detail: 'An external-system error cannot be replaced with a manual “confirmed” flag and cannot open the auction.', tone: 'critical' },
    ],
    labels: {
      blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result',
      nextAction: 'Next safe action', prioritySection: 'Primary access task', factsSection: 'Trust boundary',
    },
  },
  zh: {
    metadataTitle: '监管粮食系统访问',
    metadataDescription: '批次导入前由服务器验证组织和权限，不使用本地批次或 SDIZ 数据。',
    eyebrow: '组织 → 权限 → 外部访问 → 导入',
    title: '平台验证行动权限，不收集监管系统密码',
    description: '流程从组织和代表人验证开始。只有批准的外部适配器返回结果并通过服务器校验后，批次、SDIZ、所有者、重量和质量才会出现。',
    statusLabel: '组织和访问尚未确认',
    statusTone: 'warning',
    priority: {
      title: '通过受保护的 gov-ID 流程确认组织',
      description: '回调后，服务器校验 claims、税务标识、代表人、成员关系和请求具体批次的权限。客户端不会创建这些事实。',
      blocker: '缺少服务器签发的身份结果和访问授权',
      owner: '组织 + 合规 + 集成服务',
      impact: '批次导入和竞价保持关闭',
      result: '无需共享监管系统密码的可审计批次请求权限',
    },
    facts: [
      { label: '身份', value: '服务器回调', hint: 'claims 在 backend 校验' },
      { label: '组织', value: '税务标识 + 成员关系', hint: '不来自 URL 或 localStorage' },
      { label: '行动权限', value: '代表人角色', hint: '负责人、授权书或批准流程' },
      { label: '批次数据', value: '仅来自适配器响应', hint: '包含来源、时间和来源指纹' },
    ],
    boundary: '没有合同、凭据和运行证据时，生产监管系统访问、token exchange 和批次获取均不视为已确认。在此之前，页面不会显示虚构组织、批次、SDIZ 或重量。',
    notice: {
      title: '平台不会收集什么',
      body: '用户不会在平台中输入监管系统密码。组织确认通过受保护的外部流程启动，权限和数据由服务器验证。',
      tone: 'information',
    },
    primaryAction: { href: '/api/platform-v7/gov-id/start?flow=fgis', label: '确认监管系统组织' },
    secondaryAction: { href: '/platform-v7/auction/import', label: '查看导入要求' },
    stepsHeading: '批次访问路径',
    invariantsHeading: '安全约束',
    steps: [
      { href: '/platform-v7/fgis-access', title: '组织', detail: '校验身份 claims、成员关系和代表权限。', status: '当前阶段', tone: 'information' },
      { href: '/platform-v7/auction/import', title: '批次导入', detail: '来自批准来源的规范化服务器快照。', status: '访问前关闭', tone: 'neutral' },
      { href: '/platform-v7/auction/admission', title: '准入', detail: '服务器校验批次、卖方和买方。', status: '导入前关闭', tone: 'neutral' },
      { href: '/platform-v7/auction', title: '竞价', detail: '所有检查完成后才允许报价和中标锁定。', status: '准入前关闭', tone: 'neutral' },
    ],
    invariants: [
      { title: '不收集监管系统密码', detail: '平台使用批准的外部流程和服务器凭据，而不是用户密码。', tone: 'critical' },
      { title: 'Claims 不直接分配业务角色', detail: '组织和成员关系与 PostgreSQL 核对；URL 和客户端状态不定义角色。', tone: 'warning' },
      { title: '批次数据具有来源记录', detail: '每个批次快照记录来源、时间、指纹和关联审计事件。', tone: 'information' },
      { title: '失败必须安全', detail: '外部系统错误不能被手工“已确认”标记替代，也不能开启竞价。', tone: 'critical' },
    ],
    labels: {
      blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果',
      nextAction: '下一项安全操作', prioritySection: '主要访问任务', factsSection: '信任边界',
    },
  },
};

function normalizeLocale(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[normalizeLocale(await getLocale())];
  return { title: copy.metadataTitle, description: copy.metadataDescription };
}

export default async function FarmerFgisAccessPage() {
  const copy = COPY[normalizeLocale(await getLocale())];
  return <AuctionAuthorityRoute testId='platform-v7-fgis-access-authority-v8' {...copy} />;
}
