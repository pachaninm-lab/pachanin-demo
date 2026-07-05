#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DICTIONARY_PATH = path.join(ROOT, 'apps/web/public/platform-v7/i18n/dictionaries.json');
const TRANSLATOR_PATH = path.join(ROOT, 'apps/web/components/platform-v7/PlatformTranslator.tsx');
const TEMPLATE_PATH = path.join(ROOT, 'apps/web/app/platform-v7/template.tsx');
const CJK_CSS_PATH = path.join(ROOT, 'apps/web/styles/platform-v7-i18n-cjk.css');
const PATCH_VERSION = '2026-07-05.7';
const PATCH_UPDATED_AT = '2026-07-05T03:45:00+01:00';

const zhPatch = {
  'Публичная навигация': '公共导航',
  'Разделы главной страницы': '首页栏目',
  'Поддержка Прозрачной Цены': '透明价格支持',
  'Тема': '主题',
  'Имя': '姓名',
  'Телефон или email': '电话或邮箱',
  'Коротко опишите вопрос по платформе, пилоту, доступу, документам или техническому подключению.': '请简要说明关于平台、试点、访问、文件或技术接入的问题。',
  'Контур сделки': '交易闭环',
  'исполнение под контролем': '执行受控',
  'ожидает акт': '等待单据',
  'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.': 'SDIZ、电子文件流、运输文件和单据与交易事件相连。',
  'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.': '运输、司机、路线和检查点处于同一闭环中。',
  'Приёмка и лабораторные показатели учитываются до окончательного расчёта.': '验收和实验室指标在最终结算前被纳入考虑。',
  'Цена, объём, базис и допуски качества зафиксированы до рейса.': '价格、数量、交货基础和质量容差在运输前固定。',
  'Стороны, партия и условия исполнения сведены в единый контур.': '交易双方、批次和执行条件汇入一个统一闭环。',
  'Маршрут, водитель, транспорт и контрольные точки назначены.': '路线、司机、车辆和检查点已指定。',
  'Вес, факт поставки и расхождения фиксируются на элеваторе.': '重量、交付事实和差异在粮仓记录。',
  'Документы сверяются с событиями исполнения.': '文件与执行事件进行核对。',
  'Оплата проводится после подтверждения оснований.': '付款在依据确认后进行。',
  'Разбор ведётся по зафиксированным данным.': '复盘基于已记录的数据进行。',
  'Сделка не заканчивается на согласованной цене': '交易不会停在已确认的价格上',
  'Главный риск начинается дальше: рейс, приёмка, качество, документы, расчёт, спор и доказательства должны быть связаны в один проверяемый процесс.': '真正的风险在后续环节开始：运输、验收、质量、文件、结算、争议和证据必须连接成一个可核验流程。',
  'Видит место остановки': '看清卡点位置',
  'Показывает, где сделка требует действия: рейс, вес, качество, документ, расчёт или спор.': '显示交易在哪个环节需要行动：运输、重量、质量、文件、结算或争议。',
  'Фиксирует следующий шаг': '固定下一步动作',
  'Связывает задачу с ролью участника: продавец, покупатель, логистика, элеватор, лаборатория, банк или арбитр.': '把任务绑定到对应参与方角色：卖方、买方、物流、粮仓、实验室、银行或仲裁员。',
  'Собирает основание': '汇集结算依据',
  'Факты исполнения, документы и статусы складываются в проверяемую базу для расчёта и разбора расхождений.': '执行事实、文件和状态汇集成可核验基础，用于结算和差异复盘。',
  'вес и факт поставки': '重量和交付事实',
  'элеватор фиксирует исполнение': '粮仓记录执行事实',
  'показатели партии': '批次指标',
  'лаборатория даёт основание': '实验室提供依据',
  'СДИЗ, ЭДО, акты': 'SDIZ、电子文件流、单据',
  'комплект связан с событиями': '文件包与事件相连',
  'основание для оплаты': '付款依据',
  'деньги выпускаются по фактам': '资金按事实释放',
  'Сначала выберите роль участника сделки. После этого вход выполняется по логину, паролю и организации.': '先选择交易参与方角色。之后使用登录名、密码和组织登录。',
  'Сделки, блокеры, SLA и контрольные действия.': '交易、阻断项、服务级别和控制动作。',
  'Поставка, качество, документы и риски оплаты.': '交付、质量、文件和付款风险。',
  'Партия, рейс, приёмка и основание для оплаты.': '批次、运输、验收和付款依据。',
  'Рейсы, водители, движение и отклонения по маршруту.': '运输、司机、移动和路线偏差。',
  'Маршрут, точки рейса, фото и офлайн-доказательства.': '路线、运输检查点、照片和离线证据。',
  'Приёмка, хранение, вес и статусы партии.': '验收、仓储、重量和批次状态。',
  'Анализы, показатели качества и связь с приёмкой.': '检测、质量指标以及与验收的关联。',
  'Осмотр, фиксация фактов и независимый доказательный слой.': '检查、事实记录和独立证据层。',
  'Основания для финансирования и расчётов по подтверждённым событиям.': '基于已确认事件的融资和结算依据。',
  'Доступы, действия участников и контроль правил.': '访问权限、参与方动作和规则控制。',
  'Спор, расхождения, пакет доказательств и решение по фактам.': '争议、差异、证据包和基于事实的决定。',
  'Расчёты, блокеры, роли, споры и ход исполнения.': '结算、阻断项、角色、争议和执行进度。',
  'Статус без догадок': '无需猜测的状态',
  'Единая картина по этапам и участникам.': '按阶段和参与方形成统一视图。',
  'Юридически значимый след': '具有法律意义的轨迹',
  'События и документы связаны с исполнением сделки.': '事件和文件与交易执行相连。',
  'Контроль документов': '文件控制',
  'Комплектность, версии, сроки и ответственные под контролем.': '完整性、版本、期限和负责人处于控制中。',
  'Основа для расчётов': '结算基础',
  'Расчёт опирается на подтверждённые события.': '结算基于已确认事件。'
};

function writeIfChanged(filePath, next) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (current === next) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, next, 'utf8');
  return true;
}

const payload = JSON.parse(fs.readFileSync(DICTIONARY_PATH, 'utf8'));
payload.version = PATCH_VERSION;
payload.updatedAt = PATCH_UPDATED_AT;
payload.dictionaries = payload.dictionaries ?? {};
payload.dictionaries.zh = {
  ...(payload.dictionaries.zh ?? {}),
  ...zhPatch,
};
writeIfChanged(DICTIONARY_PATH, `${JSON.stringify(payload, null, 2)}\n`);

if (fs.existsSync(TRANSLATOR_PATH)) {
  const translator = fs.readFileSync(TRANSLATOR_PATH, 'utf8').replace(/pc-v7-translation-dictionaries-v\d+/g, 'pc-v7-translation-dictionaries-v5');
  writeIfChanged(TRANSLATOR_PATH, translator);
}

if (fs.existsSync(TEMPLATE_PATH)) {
  let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  if (!template.includes('PlatformV7I18nGuard')) {
    template = template
      .replace("import { PlatformTranslator } from '@/components/platform-v7/PlatformTranslator';\n", "import { PlatformTranslator } from '@/components/platform-v7/PlatformTranslator';\nimport { PlatformV7I18nGuard } from '@/components/platform-v7/PlatformV7I18nGuard';\n")
      .replace("import '@/styles/platform-v7-adaptive-devices.css';\n", "import '@/styles/platform-v7-adaptive-devices.css';\nimport '@/styles/platform-v7-i18n-cjk.css';\n")
      .replace('      <ViewportStabilityGuard />\n', '      <ViewportStabilityGuard />\n      <PlatformV7I18nGuard />\n');
  }
  writeIfChanged(TEMPLATE_PATH, template);
}

writeIfChanged(CJK_CSS_PATH, "html[data-p7-language='zh'] * {\n  letter-spacing: 0;\n  word-break: keep-all;\n  overflow-wrap: anywhere;\n}\nhtml[data-p7-language='zh'] h1,\nhtml[data-p7-language='zh'] h2,\nhtml[data-p7-language='zh'] h3 {\n  line-height: 1.18;\n}\n");
console.log(`[p7-i18n] patched ${Object.keys(zhPatch).length} zh keys and runtime guards`);
