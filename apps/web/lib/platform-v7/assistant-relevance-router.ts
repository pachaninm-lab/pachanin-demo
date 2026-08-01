import {
  allKnowledgeSections,
  type PlatformKnowledgeSection,
} from './platform-knowledge-sections';
import type {
  PlatformKnowledgeLocale,
  PlatformKnowledgeSectionId,
} from './assistant-capability-registry';

/**
 * Semantic admission for TAI.
 *
 * The router answers one question: may this question be answered, and from
 * which platform knowledge. It replaces the previous binary gate, which refused
 * anything that did not literally match a narrow topic list — including
 * "Как защищаются данные?", a question the platform itself suggests.
 *
 * Admission is broad by design. A question passes when *any* strong signal ties
 * it to the platform, to agriculture or to running an agribusiness: an explicit
 * domain term, the conversation so far, the surface the reader is standing on,
 * or a semantic judgement from the model. A refusal requires all of them to be
 * absent at once. Safety limits are separate and are never weakened by this.
 *
 * Nothing produced here is meant for a reader. Decisions, signals and section
 * ids are internal vocabulary: the surrounding route turns them into an answer.
 */

export type AssistantRelevanceDecision =
  | 'ALLOW_DIRECT'
  | 'ALLOW_CONTEXTUAL'
  | 'ALLOW_ADJACENT'
  | 'CLARIFY_WITH_PARTIAL_ANSWER'
  | 'REDIRECT_UNRELATED'
  | 'BLOCK_SAFETY';

export type AssistantRelevanceSignal =
  | 'platform_term'
  | 'agro_term'
  | 'business_term'
  | 'conversation'
  | 'surface'
  | 'semantic_hint';

export type AssistantSafetyReason =
  | 'FOREIGN_DATA'
  | 'PRIVILEGE_ESCALATION'
  | 'CREDENTIAL_DISCLOSURE'
  | 'HARMFUL_REQUEST';

export type AssistantConversationTurn = Readonly<{ role: 'user' | 'assistant'; text: string }>;

export type AssistantSelectedObjectKind =
  | 'deal' | 'document' | 'field' | 'machine' | 'animal' | 'lot' | 'trip' | 'dispute' | 'payment';

/**
 * Everything routing is allowed to know about the reader.
 *
 * `role` is the exact cabinet role from a verified session — not a coarse class.
 * Collapsing it before routing is what previously made role-specific answers
 * disappear, so the field travels through unchanged and is never taken from the
 * request body. Organization and object identifiers are deliberately absent:
 * routing needs the *kind* of object in front of the reader, never its id, and
 * never anything belonging to another organization or another conversation.
 */
export type AssistantRoutingContext = Readonly<{
  locale: PlatformKnowledgeLocale;
  /** Current platform page path, server-derived. */
  page: string | null;
  /** Whether the reader is inside a workspace at all (never which one). */
  insideWorkspace: boolean;
  /** Exact cabinet role from the verified session, or null when anonymous. */
  role: string | null;
  authenticated: boolean;
  selectedObject: AssistantSelectedObjectKind | null;
  /** Section resolved for the previous answer in this conversation. */
  previousTopic: PlatformKnowledgeSectionId | null;
  recentMessages: readonly AssistantConversationTurn[];
  hasAttachment: boolean;
  /** True when the question was asked from inside TAI or a platform page. */
  onPlatformSurface: boolean;
  /** Optional relatedness judgement supplied by the model. */
  semanticHint: 'related' | 'unrelated' | null;
}>;

export type AssistantRelevanceOutcome = Readonly<{
  decision: AssistantRelevanceDecision;
  /** Platform knowledge section to answer from, when the question resolves to one. */
  section: PlatformKnowledgeSectionId | null;
  domain: 'platform' | 'agro' | 'business' | 'mixed' | 'none';
  signals: readonly AssistantRelevanceSignal[];
  /** True when a short question was read as being about the platform. */
  platformFirst: boolean;
  safetyReason: AssistantSafetyReason | null;
  /** Section whose clarifying question should follow the partial answer. */
  clarifySection: PlatformKnowledgeSectionId | null;
}>;

export function emptyRoutingContext(
  locale: PlatformKnowledgeLocale = 'ru',
  overrides: Partial<AssistantRoutingContext> = {},
): AssistantRoutingContext {
  return Object.freeze({
    locale,
    page: null,
    insideWorkspace: false,
    role: null,
    authenticated: false,
    selectedObject: null,
    previousTopic: null,
    recentMessages: [],
    hasAttachment: false,
    onPlatformSurface: false,
    semanticHint: null,
    ...overrides,
  });
}

/* ------------------------------------------------------------------ lexicons */

/**
 * Lexicon entries use one convention: a trailing `*` means "this stem plus any
 * ending", anything else must match a whole word.
 *
 * The convention exists because Russian stems and short abbreviations behave
 * very differently. `кот` as a prefix silently swallows `который`, and `поле`
 * swallows `полезный` — the kind of match that turns a question about something
 * useful into a question about a field. Marking intent per entry keeps that
 * decision visible instead of hiding it in a length heuristic.
 */
const AGRO_OBJECTS = [
  'пшениц*', 'ячмен*', 'кукуруз*', 'подсолнеч*', 'рапс*', 'соя', 'сои', 'сое', 'соей', 'овес', 'овса', 'рожь', 'ржи',
  'гречих*', 'горох*', 'лен', 'льна', 'зерн*', 'урожа*', 'посев*', 'всход*', 'семен*', 'семечк*', 'сорт', 'сорта',
  'сортов', 'гибрид*', 'почв*', 'грунт*', 'поле', 'поля', 'полях', 'полей', 'гектар*', 'угодь*', 'пашн*',
  'удобрен*', 'подкорм*', 'гербицид*', 'фунгицид*', 'инсектицид*', 'пестицид*', 'протравител*', 'сзр',
  'вредител*', 'сорняк*', 'фитосанитар*', 'севооборот*', 'агроном*', 'агротехник*', 'вегетац*', 'полив*', 'ороше*',
  'трактор*', 'комбайн*', 'сеялк*', 'опрыскиват*', 'жатк*', 'плуг*', 'культиватор*', 'борон*', 'сельхозтехник*',
  'скот', 'скота', 'скоту', 'коров*', 'телен*', 'телят*', 'бык', 'быки', 'свин*', 'овц*', 'птиц*', 'куриц*',
  'бройлер*', 'корм', 'корма', 'кормов*', 'кормл*', 'надо*', 'привес*', 'падеж*', 'стад*', 'поголов*', 'ветеринар*',
  'силос*', 'сенаж*', 'сено', 'солом*', 'жмых*', 'шрот*', 'комбикорм*',
  'зернохранилищ*', 'амбар*', 'сушилк*', 'клейковин*', 'протеин*', 'натур*', 'зараженност*', 'сорност*',
  'wheat', 'barley', 'corn', 'maize', 'sunflower', 'rapeseed', 'soybean*', 'grain*', 'harvest*', 'crop*',
  'sowing', 'seed', 'seeds', 'soil', 'fertili*', 'herbicide*', 'fungicide*', 'pesticide*', 'pest', 'pests',
  'weed', 'weeds', 'agronom*', 'tractor*', 'combine harvester', 'sprayer*', 'livestock', 'cattle', 'cow', 'cows',
  'pig', 'pigs', 'poultry', 'feed', 'silage', 'granary', 'gluten', 'irrigation', 'field', 'fields', 'farm', 'farms',
  '小麦', '大麦', '玉米', '向日葵', '油菜', '大豆', '谷物', '粮食', '收获', '作物', '播种', '种子', '土壤',
  '化肥', '除草剂', '杀菌剂', '农药', '害虫', '杂草', '农艺', '拖拉机', '联合收割机', '喷雾机', '牲畜',
  '奶牛', '生猪', '家禽', '饲料', '青贮', '田地', '农场', '面筋', '蛋白',
] as const;

/** Subjects that make a question about the product rather than about a field. */
const PLATFORM_SUBJECTS = [
  'данн*', 'платформ*', 'систем*', 'сервис*', 'кабинет*', 'аккаунт*', 'учетн*', 'профил*',
  'сделк*', 'документ*', 'договор*', 'аукцион*', 'ставк*', 'лот', 'лота', 'лоты', 'заявк*',
  'приложен*', 'сайт*', 'интерфейс*', 'пользовател*', 'роль', 'роли', 'ролей', 'доступ*',
  'логин*', 'парол*', 'сесси*', 'организац*', 'помощник*', 'файл*', 'вложени*', 'загрузк*',
  'data', 'platform*', 'system*', 'service', 'workspace*', 'account*', 'profile', 'deal', 'deals',
  'document*', 'contract*', 'auction*', 'bid', 'bids', 'application', 'website', 'interface',
  'user', 'users', 'role', 'roles', 'access', 'login', 'password*', 'session*', 'assistant',
  'file', 'files', 'upload', 'attachment*',
  '数据', '平台', '系统', '服务', '工作台', '账户', '资料', '交易', '文件', '合同', '竞价', '出价',
  '网站', '界面', '用户', '角色', '权限', '登录', '密码', '会话', '助手',
] as const;

/** Core agribusiness execution vocabulary — always a direct topic. */
const AGRO_BUSINESS_TERMS = [
  'логистик*', 'перевозк*', 'перевозчик*', 'водител*', 'рейс*', 'фур*', 'вагон*', 'отгрузк*',
  'погрузк*', 'выгрузк*', 'элеватор*', 'приемк*', 'взвешива*', 'лаборатор*', 'протокол*',
  'сюрвей*', 'хранени*', 'склад*', 'парти*', 'закупк*', 'продаж*', 'поставк*', 'котировк*',
  'трейд*', 'экспорт*', 'импорт*', 'пошлин*', 'оплат*', 'выплат*', 'расчет*', 'аванс*',
  'предоплат*', 'отсрочк*', 'взаиморасчет*', 'дебиторск*', 'спор', 'спора', 'споры', 'спорам',
  'претензи*', 'арбитраж*', 'штраф*', 'неустойк*', 'рекламац*', 'фгис', 'сдиз', 'эдо', 'упд',
  'ттн', 'накладн*', 'счет-фактур*', 'влажност*', 'качеств*', 'деньг*', 'продавец', 'продавц*',
  'покупател*', 'выручк*', 'сумм*', 'цена', 'цены', 'ценам', 'стоимост*',
  'logistics', 'transport*', 'carrier*', 'driver', 'drivers', 'shipment*', 'loading', 'unloading',
  'acceptance', 'weighing', 'laboratory', 'survey', 'surveyor', 'storage', 'warehouse*',
  'procurement', 'sales', 'supply', 'quotation*', 'trading', 'export*', 'import*', 'duty', 'duties',
  'payment*', 'settlement*', 'advance', 'deferral', 'dispute*', 'claim*', 'arbitration', 'penalt*',
  'invoice*', 'waybill*', 'consignment*', 'elevator', 'moisture', 'quality',
  '物流', '运输', '承运', '司机', '发运', '装车', '卸货', '验收', '称重', '实验室', '检验',
  '仓储', '库存', '采购', '销售', '供应', '报价', '贸易', '出口', '进口', '关税', '付款',
  '结算', '预付', '账期', '争议', '索赔', '仲裁', '罚金', '发票', '运单', '粮库', '水分', '质量',
] as const;

/** Adjacent topics: useful to an agribusiness reader without being the core domain. */
const BUSINESS_ADJACENT_TERMS = [
  'налог*', 'ндс', 'бухгалтер*', 'учет*', 'отчетност*', 'финанс*', 'бюджет*', 'себестоимост*',
  'кредит*', 'заем', 'займ*', 'лизинг*', 'факторинг*', 'субсиди*', 'грант*', 'инвестиц*',
  'окупаемост*', 'рентабельност*', 'маржа', 'маржи', 'страхован*', 'страховк*', 'риск*',
  'хеджир*', 'валют*', 'курс', 'курса', 'курсы', 'инфляц*', 'юрист*', 'юридическ*', 'комплаенс*',
  'контрагент*', 'санкц*', 'регулирован*', 'законодательств*', 'персонал*', 'кадр*', 'сотрудник*',
  'найм*', 'мотивац*', 'обучени*', 'зарплат*', 'управлени*', 'стратег*', 'kpi', 'процесс*',
  'регламент*', 'автоматизац*', 'цифровизац*', 'внедрен*', 'миграц*', 'api', 'erp', 'crm', '1с',
  'интеграц*', 'аналитик*', 'отчет*', 'дашборд*', 'прогноз*', 'погод*', 'засух*', 'заморозк*',
  'осадк*', 'рынок', 'рынка', 'рынке', 'конкурент*', 'маркетинг*', 'тендер*', 'esg', 'sla',
  'tax', 'taxes', 'vat', 'accounting', 'reporting', 'finance', 'budget', 'cost price', 'credit',
  'loan', 'loans', 'leasing', 'factoring', 'subsidy', 'subsidies', 'grant', 'investment*',
  'payback', 'profitabilit*', 'margin*', 'insurance', 'risk', 'risks', 'hedging', 'currency',
  'exchange rate', 'inflation', 'legal', 'compliance', 'counterparty', 'sanction*', 'regulation*',
  'legislation', 'staff', 'hiring', 'training', 'payroll', 'management', 'strategy', 'process*',
  'automation', 'digitali*', 'implementation', 'analytics', 'dashboard*', 'forecast*', 'weather',
  'drought', 'market', 'markets', 'competitor*', 'marketing', 'tender*',
  '税', '增值税', '会计', '报表', '财务', '预算', '成本', '信贷', '贷款', '租赁', '保理', '补贴',
  '投资', '回报', '利润率', '保险', '风险', '套期', '汇率', '通胀', '法律', '合规', '制裁',
  '监管', '法规', '人员', '招聘', '培训', '工资', '管理', '战略', '流程', '自动化', '数字化',
  '实施', '分析', '仪表板', '预测', '天气', '干旱', '市场', '竞争', '营销', '招标',
] as const;

/** Questions with no reasonable link to the platform, agriculture or running a business. */
const UNRELATED_TERMS = [
  'анекдот*', 'шутк*', 'мем', 'мемы', 'гороскоп*', 'зодиак*', 'гадани*', 'таро', 'сонник*',
  'футбол*', 'хоккей*', 'матч*', 'чемпионат*', 'олимпиад*', 'киберспорт*', 'дота',
  'сериал*', 'фильм*', 'кино', 'аниме', 'мультик*', 'актер*', 'актрис*', 'певиц*', 'певец',
  'клип*', 'песн*', 'рэп', 'знакомств*', 'свидани*', 'видеоигр*', 'приставк*', 'playstation',
  'xbox', 'майнкрафт*', 'стих*', 'сочинени*', 'уравнени*', 'похуде*', 'диет*', 'трениров*', 'спортзал*',
  'бодибилдинг*', 'макияж*', 'маникюр*', 'татуировк*', 'гитар*', 'обои', 'сантехник*',
  'ремонт квартиры', 'детский сад', 'авиабилет*', 'смартфон*', 'котенк*', 'щенк*', 'аквариум*',
  'подар*', 'годовщин*', 'свадьб*', 'юбиле*', 'отдых на мор*', 'курорт*',
  'joke', 'jokes', 'meme', 'memes', 'horoscope*', 'zodiac', 'tarot', 'football', 'soccer',
  'hockey', 'championship', 'olympic*', 'tv series', 'movie', 'movies', 'anime', 'cartoon*',
  'actor', 'actress', 'singer', 'music video', 'dating', 'video game*', 'minecraft', 'poem',
  'poems', 'equation', 'weight loss', 'lose weight', 'diet', 'gym workout', 'bodybuilding', 'makeup', 'manicure',
  'tattoo*', 'guitar', 'wallpaper', 'plumber', 'kindergarten', 'flight ticket*', 'smartphone*',
  'kitten*', 'puppy', 'puppies', 'aquarium',
  '笑话', '段子', '星座', '塔罗', '足球', '冰球', '锦标赛', '奥运', '电视剧', '电影', '动漫',
  '演员', '歌手', '交友', '约会', '电子游戏', '减肥', '健身房', '化妆', '美甲', '纹身',
  '吉他', '壁纸', '水管工', '幼儿园', '机票', '智能手机', '小猫', '小狗', '鱼缸',
] as const;

/* -------------------------------------------------------------- safety rules */

/**
 * Safety patterns are written against Cyrillic explicitly.
 *
 * `\w` and `\b` are ASCII-only in JavaScript, so a pattern that reads correctly
 * — `дай\w*\s+прав\w*` — silently never matches a Russian sentence. Word
 * continuation is `[\p{L}\p{N}]*` and boundaries are spelled out, because a
 * safety rule that quietly matches nothing is worse than no rule at all.
 */
const W = '[\\p{L}\\p{N}]*';
const SPACE = '[\\s,]+';

function ru(pattern: string): RegExp {
  return new RegExp(pattern.replace(/\\w\*/gu, W).replace(/\\_/gu, SPACE), 'iu');
}

const FOREIGN_DATA_PATTERNS = [
  ru('(?:покажи|открой|дай|выведи|получи|скинь|найди|выгрузи)\\w*\\_(?:[\\p{L}\\p{N}]+\\_){0,4}?(?:чуж|друг(?:ой|ая|ие|их|ого)|сторонн|соседн)\\w*\\_?(?:организац|компан|пользовател|сделк|кабинет|данн|документ|клиент)\\w*'),
  ru('(?:данн|сделк|документ|цен|контакт)\\w*\\_(?:чуж|друг(?:ой|ого|их))\\w*(?:\\_(?:организац|компан|пользовател|клиент)\\w*)?'),
  /(?:show|open|give|fetch|find|list)\s+(?:me\s+)?(?:\w+\s+){0,4}?(?:another|other|someone else|different)\s+(?:organization|organisation|company|user|deal|workspace|account|customer)/iu,
  /(?:显示|打开|给我|获取|查找)[^？。!]{0,40}(?:他人|别人|其他(?:组织|公司|用户))/u,
] as const;

const PRIVILEGE_ESCALATION_PATTERNS = [
  ru('(?:дай|выдай|назначь|поменяй|смени|повыс|получит|хочу|нужн)\\w*\\_(?:(?:мне|мои|моих|мой|себе)\\_){0,2}(?:прав\\w*\\_(?:администратор|доступа)|роль\\_(?:администратор|владельц)|полномочи|админ\\w*\\_?доступ)\\w*'),
  ru('(?:обойд|обойт|обход|отключ|снят|убер|убра|минуя)\\w*\\_(?:проверк\\w*\\_прав|ограничени\\w*\\_доступа|авторизац|аутентификац|защит\\w*\\_доступа)\\w*'),
  /(?:grant|give|escalate|elevate|change)\s+(?:me\s+)?(?:admin(?:istrator)?\s+(?:rights|access|role)|owner\s+role|higher\s+privileges)/iu,
  /(?:bypass|disable|turn\s+off|circumvent)\s+(?:the\s+)?(?:permission\s+check|access\s+control|authorization|authentication)/iu,
  /(?:给我|授予)[^？。!]{0,20}(?:管理员|更高)(?:权限|角色)|绕过(?:权限|鉴权|认证)/u,
] as const;

const CREDENTIAL_PATTERNS = [
  ru('(?:скажи|назови|покажи|пришли|дай|сообщи)\\w*\\_(?:мне\\_)?(?:пароль|логин\\_и\\_пароль|api[\\s_-]?ключ|секретн\\w*\\_ключ|токен\\_доступа|ключ\\_шифрован)\\w*'),
  /(?:tell|give|show|send)\s+(?:me\s+)?(?:the\s+)?(?:password|api\s*key|secret\s+key|access\s+token|encryption\s+key)/iu,
  /(?:告诉|给)我[^？。!]{0,10}(?:密码|api\s*密钥|密钥|访问令牌)/u,
] as const;

/**
 * Harm patterns require a human target on purpose.
 *
 * Rodent and insect control is ordinary agronomy: a question about poisoning
 * pests in a granary is a legitimate one for this assistant, and only a request
 * aimed at a person is not.
 */
const HARMFUL_PATTERNS = [
  ru('(?:отрав|убить|убива|покалеч|навред)\\w*\\_(?:человек|люд|сотрудник|конкурент|соседа|партнер)\\w*'),
  ru('(?:изготов|сдела|собра|смастер)\\w*\\_(?:взрывчат|бомб|оруж)\\w*'),
  ru('(?:взлома|хакн|подобрать\\_пароль\\_к)\\w*\\_(?:чуж|сайт|систем|аккаунт|почт)\\w*'),
  /(?:poison|kill|harm|hurt)\s+(?:a\s+)?(?:person|people|human|employee|competitor|neighbour|neighbor)/iu,
  /(?:make|build|assemble)\s+(?:a\s+)?(?:bomb|explosive|weapon)/iu,
  /(?:hack|break\s+into|crack\s+the\s+password\s+of)\s+(?:an?\s+|the\s+|my\s+|someone(?:'s)?\s+)?(?:site|system|account|email|someone)/iu,
  /(?:毒害|杀害|伤害)(?:人|员工|竞争对手)|制作(?:炸弹|爆炸物|武器)|入侵(?:网站|系统|账户)/u,
] as const;

/* ----------------------------------------------------------- short questions */

/**
 * Short questions whose subject lives in the previous turn or on the page.
 *
 * Each pattern names the section it resolves to under the platform-first
 * assumption. "Кто это увидит?" is not a vague question when the reader is
 * standing inside the platform — it is a question about visibility.
 */
const CONTEXTUAL_SHAPES: readonly Readonly<{
  pattern: RegExp;
  section: PlatformKnowledgeSectionId;
}>[] = [
  { pattern: /(?:кто\s+(?:это\s+)?(?:увидит|видит|сможет\s+увидеть|получит\s+доступ)|who\s+(?:will\s+)?(?:see|sees|can\s+see|has\s+access)|谁(?:能|会)?看到)/iu, section: 'privacy' },
  { pattern: /(?:куда\s+(?:это\s+)?(?:сохран|попад|запис)|где\s+(?:это\s+)?(?:хран|лежит|сохран)|where\s+(?:is|are)\s+(?:it|this|the\s+data|they)\s+(?:stored|saved|kept)|存(?:在|放)哪)/iu, section: 'data_protection' },
  { pattern: /(?:кто\s+отвеча\w*|кто\s+несет\s+ответственност|чья\s+это\s+зона|who\s+is\s+responsible|who\s+owns\s+this\s+step|谁负责)/iu, section: 'roles_permissions' },
  { pattern: /(?:безопасн\w*\s*\??$|^\s*(?:а\s+)?(?:это\s+)?безопасно|is\s+(?:it|this)\s+(?:safe|secure)|安全吗)/iu, section: 'platform_security' },
  { pattern: /(?:данн\w*\s+защищ|защищ\w*\s+ли\s+данн|is\s+(?:my|the)\s+data\s+(?:safe|protected)|数据(?:安全|受保护)吗)/iu, section: 'platform_security' },
  { pattern: /(?:можно\s+(?:ли\s+)?удалит|удалит\w*\s+ли|can\s+(?:i|we)\s+delete|可以删除吗)/iu, section: 'deletion' },
  { pattern: /(?:сколько\s+(?:это\s+)?стоит|какая\s+цена|how\s+much\s+(?:does\s+(?:it|this)\s+cost|is\s+it)|多少钱|价格是多少)/iu, section: 'pricing_usage' },
  { pattern: /(?:если\s+(?:произойдет|случится|будет)\s+(?:ошибк|сбо|авари)|что\s+(?:если|будет\s+при)\s+сбо|what\s+(?:if|happens)\s+(?:there\s+is\s+)?(?:an\s+error|a\s+failure|it\s+fails)|出错|故障时)/iu, section: 'recovery' },
  { pattern: /(?:как\s+(?:восстановит|вернут)\w*\s+доступ|не\s+могу\s+войти|how\s+(?:do\s+i|to)\s+(?:restore|regain)\s+access|cannot\s+log\s+in|如何恢复访问|无法登录)/iu, section: 'sessions' },
  { pattern: /(?:сколько\s+хранит|как\s+долго\s+хранит|how\s+long\s+(?:is\s+it|do\s+you)\s+(?:stored|store|keep)|保存多久)/iu, section: 'retention' },
];

/** Deixis: the sentence points at something said earlier or shown on screen. */
const DEIXIS_PATTERN = /(?:^|\s)(?:это|этого|этому|этим|эта|этот|эти|их|его|ее|там|тут|здесь|туда|оно|он|она)(?:\s|$|\?|,)|(?:^|\s)(?:it|this|that|these|those|they|there|here)(?:\s|$|\?|,)|(?:这个|那个|它|他们|这里|那里)/iu;

/** Openers that mark a continuation rather than a new subject. */
const FOLLOW_UP_OPENER = /^(?:а|и|но|тогда|значит|ок|окей|хорошо|ясно|понятно|еще|также|кстати|подробнее|почему|зачем|как|когда|где|кто|что|сколько|можно|нужно)\b|^(?:and|but|so|then|ok|okay|also|more|why|how|when|where|who|what|can|should|is|does)\b|^(?:那|还|再|为什么|怎么|谁|什么|多少|可以)/iu;

/* --------------------------------------------------------------- normalizing */

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/gu, 'е')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

const MATCHERS = new Map<string, RegExp | string>();

/**
 * Compiles a lexicon entry once.
 *
 * Han script has no word separators, so those entries stay plain substrings;
 * everything else is anchored at a word boundary, with `*` deciding whether an
 * ending may follow.
 */
function matcherFor(entry: string): RegExp | string {
  const cached = MATCHERS.get(entry);
  if (cached) return cached;
  const stem = entry.endsWith('*');
  const term = normalize(stem ? entry.slice(0, -1) : entry);
  const compiled: RegExp | string = /\p{Script=Han}/u.test(term)
    ? term
    : new RegExp(`(?:^|[\\s-])${escapeRegExp(term)}${stem ? '[\\p{L}\\p{N}-]*' : ''}(?:$|[\\s-])`, 'u');
  MATCHERS.set(entry, compiled);
  return compiled;
}

function containsAny(haystack: string, needles: readonly string[]): boolean {
  // The trailing space lets a whole-word matcher see the end of the last word
  // without a lookahead that would also have to cope with punctuation.
  const padded = ` ${haystack} `;
  for (const needle of needles) {
    const matcher = matcherFor(needle);
    if (typeof matcher === 'string') {
      if (haystack.includes(matcher)) return true;
    } else if (matcher.test(padded)) {
      return true;
    }
  }
  return false;
}

function wordCount(value: string): number {
  const words = value.split(' ').filter(Boolean).length;
  const han = (value.match(/\p{Script=Han}/gu) || []).length;
  return han > 0 ? Math.max(words, Math.ceil(han / 2)) : words;
}

function isShortQuestion(normalized: string): boolean {
  return wordCount(normalized) <= 7;
}

/* ------------------------------------------------------------ section lookup */

function matchSection(normalized: string): PlatformKnowledgeSection | null {
  const padded = ` ${normalized} `;
  let best: PlatformKnowledgeSection | null = null;
  let bestScore = 0;
  for (const section of allKnowledgeSections()) {
    let score = 0;
    for (const locale of ['ru', 'en', 'zh'] as const) {
      for (const term of section.match[locale]) {
        const needle = normalize(term);
        if (!needle) continue;
        const hit = /\p{Script=Han}/u.test(needle)
          ? normalized.includes(needle)
          : padded.includes(` ${needle}`);
        if (hit) score = Math.max(score, needle.length);
      }
    }
    if (score > bestScore) {
      best = section;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

function contextualSection(normalized: string): PlatformKnowledgeSectionId | null {
  for (const shape of CONTEXTUAL_SHAPES) {
    if (shape.pattern.test(normalized)) return shape.section;
  }
  return null;
}

function safetyReasonFor(raw: string, normalized: string): AssistantSafetyReason | null {
  if (HARMFUL_PATTERNS.some((pattern) => pattern.test(raw) || pattern.test(normalized))) return 'HARMFUL_REQUEST';
  if (CREDENTIAL_PATTERNS.some((pattern) => pattern.test(raw) || pattern.test(normalized))) return 'CREDENTIAL_DISCLOSURE';
  if (PRIVILEGE_ESCALATION_PATTERNS.some((pattern) => pattern.test(raw) || pattern.test(normalized))) return 'PRIVILEGE_ESCALATION';
  if (FOREIGN_DATA_PATTERNS.some((pattern) => pattern.test(raw) || pattern.test(normalized))) return 'FOREIGN_DATA';
  return null;
}

/* ------------------------------------------------------------------- routing */

export function routeAssistantQuestion(
  question: string,
  context: AssistantRoutingContext,
): AssistantRelevanceOutcome {
  const raw = question.trim();
  const normalized = normalize(raw);

  // Safety is evaluated before anything else and is never traded against
  // relevance: a broader admission policy must not widen what may be asked for.
  const safetyReason = safetyReasonFor(raw, normalized);
  if (safetyReason) return outcome('BLOCK_SAFETY', { safetyReason, domain: 'none' });

  if (!normalized) return outcome('CLARIFY_WITH_PARTIAL_ANSWER', { domain: 'none' });

  const signals: AssistantRelevanceSignal[] = [];

  const hasAgroObject = containsAny(normalized, AGRO_OBJECTS);
  const hasPlatformSubject = containsAny(normalized, PLATFORM_SUBJECTS);
  const hasAgroBusiness = containsAny(normalized, AGRO_BUSINESS_TERMS);
  const hasAdjacent = containsAny(normalized, BUSINESS_ADJACENT_TERMS);
  const directSection = matchSection(normalized);

  // An agrarian object beats an ambiguous security verb. "Как защитить пшеницу"
  // and "Как защищаются данные" share a verb and nothing else; only the second
  // one is a platform question.
  const agronomyWins = hasAgroObject && !hasPlatformSubject;

  if (hasAgroObject || hasAgroBusiness) signals.push('agro_term');
  if (directSection && !agronomyWins) signals.push('platform_term');
  if (hasAdjacent) signals.push('business_term');

  const surface = context.onPlatformSurface
    || context.authenticated
    || context.insideWorkspace
    || Boolean(context.role)
    || Boolean(context.selectedObject)
    || Boolean(context.page);
  if (surface) signals.push('surface');

  const conversationText = normalize(context.recentMessages.slice(-6).map((turn) => turn.text).join(' '));
  const conversationRelated = Boolean(context.previousTopic)
    || (conversationText.length > 0 && (
      containsAny(conversationText, PLATFORM_SUBJECTS)
      || containsAny(conversationText, AGRO_OBJECTS)
      || containsAny(conversationText, AGRO_BUSINESS_TERMS)
      || matchSection(conversationText) !== null
    ));
  if (conversationRelated) signals.push('conversation');

  if (context.semanticHint === 'related') signals.push('semantic_hint');

  const hasUnrelatedSubject = containsAny(normalized, UNRELATED_TERMS);

  // A named off-topic subject outranks generic section vocabulary and sentence
  // shape, but never an explicit platform, agriculture or business subject.
  // This redirects "Кто увидит этот фильм?" while keeping "фильм о платформе"
  // and "видео о пшенице" answerable.
  if (
    hasUnrelatedSubject
    && !hasAgroObject
    && !hasPlatformSubject
    && !hasAgroBusiness
    && !hasAdjacent
    && context.semanticHint !== 'related'
  ) {
    return outcome('REDIRECT_UNRELATED', { domain: 'none', signals });
  }

  const shapeSection = contextualSection(normalized);
  const short = isShortQuestion(normalized);
  const deictic = DEIXIS_PATTERN.test(normalized) || FOLLOW_UP_OPENER.test(normalized);

  // Direct agriculture: answered as agriculture, not routed into platform copy.
  if (agronomyWins) {
    return outcome('ALLOW_DIRECT', { domain: hasAdjacent ? 'mixed' : 'agro', signals, section: null });
  }

  // Direct platform question: an explicit section term is present.
  if (directSection) {
    return outcome('ALLOW_DIRECT', {
      domain: 'platform',
      signals,
      section: directSection.id,
      platformFirst: !hasPlatformSubject && short,
    });
  }

  // Direct agribusiness execution question.
  if (hasAgroBusiness) {
    return outcome('ALLOW_DIRECT', { domain: hasAdjacent ? 'mixed' : 'agro', signals, section: null });
  }

  // Short question shaped by the surface or the previous turn. Inside the
  // platform, "Кто это увидит?" is about the platform — the reader should not
  // have to repeat the subject they are literally looking at.
  if (shapeSection) {
    return outcome('ALLOW_CONTEXTUAL', {
      domain: 'platform',
      signals,
      section: shapeSection,
      platformFirst: !hasPlatformSubject,
    });
  }

  if (short && deictic && (conversationRelated || surface)) {
    return outcome('ALLOW_CONTEXTUAL', {
      domain: context.previousTopic ? 'platform' : 'mixed',
      signals,
      section: context.previousTopic,
      platformFirst: !hasPlatformSubject,
    });
  }

  if (hasPlatformSubject) {
    return outcome('ALLOW_DIRECT', { domain: 'platform', signals, section: null });
  }

  // Adjacent topics are admitted whenever they can plausibly serve an
  // agribusiness reader — taxes, credit, insurance, hiring, automation, weather
  // and prices all change how a farm or a trader operates.
  if (hasAdjacent) {
    return outcome('ALLOW_ADJACENT', { domain: 'business', signals, section: null });
  }

  // A question tied to the conversation or supported by the model is answered
  // even without a lexical hit: this is the case the previous gate got wrong
  // most often.
  if (conversationRelated || context.semanticHint === 'related') {
    return outcome('ALLOW_CONTEXTUAL', {
      domain: context.previousTopic ? 'platform' : 'mixed',
      signals,
      section: context.previousTopic,
      platformFirst: surface,
    });
  }

  if (context.semanticHint === 'unrelated') {
    return outcome('REDIRECT_UNRELATED', { domain: 'none', signals });
  }

  // Standing inside the platform with a short or referring question is itself a
  // signal: answer the useful general part first and ask one narrowing question,
  // instead of refusing.
  if (surface && (short || deictic)) {
    return outcome('CLARIFY_WITH_PARTIAL_ANSWER', {
      domain: 'platform',
      signals,
      section: context.previousTopic,
      clarifySection: context.previousTopic ?? 'platform_security',
      platformFirst: true,
    });
  }

  // No domain term, no conversation link, no semantic support, and a question
  // fully spelled out on a subject none of them cover — the only case where a
  // redirect is the honest answer.
  return outcome('REDIRECT_UNRELATED', { domain: 'none', signals });
}

function outcome(
  decision: AssistantRelevanceDecision,
  parts: Partial<Omit<AssistantRelevanceOutcome, 'decision'>> = {},
): AssistantRelevanceOutcome {
  return Object.freeze({
    decision,
    section: parts.section ?? null,
    domain: parts.domain ?? 'none',
    signals: Object.freeze([...new Set(parts.signals ?? [])]),
    platformFirst: parts.platformFirst ?? false,
    safetyReason: parts.safetyReason ?? null,
    clarifySection: parts.clarifySection ?? null,
  });
}

/**
 * The section the conversation was last about.
 *
 * Derived from the reader's own turns rather than stored server-side: the
 * assistant holds no conversation state between requests, and reconstructing the
 * subject from the transcript keeps it that way. The newest matching turn wins,
 * so a conversation that moved on is not dragged back to where it started.
 */
export function resolvePreviousTopic(
  messages: readonly AssistantConversationTurn[],
): PlatformKnowledgeSectionId | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const turn = messages[index];
    if (turn.role !== 'user') continue;
    const normalized = normalize(turn.text);
    const section = matchSection(normalized) ?? null;
    if (section) return section.id;
    const shaped = contextualSection(normalized);
    if (shaped) return shaped;
  }
  return null;
}

/** Decisions that must produce a useful answer rather than a deflection. */
export const ANSWERING_DECISIONS: readonly AssistantRelevanceDecision[] = [
  'ALLOW_DIRECT', 'ALLOW_CONTEXTUAL', 'ALLOW_ADJACENT', 'CLARIFY_WITH_PARTIAL_ANSWER',
];

export function isAnswering(decision: AssistantRelevanceDecision): boolean {
  return ANSWERING_DECISIONS.includes(decision);
}
