/**
 * Answer-safety primitives for the restricted public TAI contour.
 *
 * These rules used to live inside the buffered generator, which made them
 * structurally whole-answer: every one of them could only run once the model had
 * finished. True streaming needs the same rules applied to text the model has
 * only partially produced, so they live here as block-level predicates that a
 * streaming gate and the buffered path both call.
 *
 * Nothing in this module is allowed to weaken when it runs incrementally. A rule
 * that cannot decide on a block yet is the streaming gate's problem — it holds
 * the text back — not a reason for the rule to pass it.
 */

export type PublicLocale = 'ru' | 'en' | 'zh';
export type PublicAnswerMode = 'verified_platform' | 'general_agro';

export type PublicSource = Readonly<{ label: string; href: string }>;
export type PublicGrounding = Readonly<{
  knowledgeVersion: string;
  topic: string;
  title: string;
  answer: string;
  facts: readonly string[];
  maturity: string;
  confidence: 'high' | 'medium';
  sources: readonly PublicSource[];
}>;

export const WRITE_CLAIM_PATTERN = /(?:я|i|我).{0,40}(?:изменил|удалил|подписал|выплатил|перев[её]л|подтвердил выплату|changed|deleted|signed|paid|transferred|released funds|修改了|删除了|签署了|付款了|转账了)/iu;
export const SECRET_PATTERN = /(?:\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b|\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b)/u;
export const HIGH_RISK_ENTITY_PATTERNS = [
  /1с/iu,
  /smartseeds/iu,
  /(?:фгис\s*[«"']?зерно|fgis\s+grain)/iu,
  /(?:эдо|edo|erp|tms)/iu,
  /(?:банк\s+россии|центробанк|central\s+bank)/iu,
] as const;
export const LIVE_CAPABILITY_PATTERN = /(?:уже\s+(?:работает|доступн\w*|подключен\w*)|интеграц\w*.{0,35}(?:работает|подключен\w*|доступн\w*)|в\s+реальном\s+времени|автоматически\s+(?:выгружает|переда[её]т|обменивает|подписывает|оплачивает)|is\s+live|already\s+available|real[-\s]?time|已上线|实时)/iu;
// JavaScript word boundaries do not treat Cyrillic letters as Unicode words reliably.
// Deliberately avoid \b around units such as "руб." and match only in the
// already-classified current-evidence contour.
export const EXACT_CURRENT_CLAIM_PATTERN = /(?:\d{1,3}(?:[ \u00A0\u202F]\d{3})*(?:[.,]\d+)?\s*(?:%|₽|руб(?:\.|лей|ля)?|долл(?:\.|аров)?|т\/га|ц\/га|тонн(?:а|ы)?|тыс\.?|млн\.?|°c)|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/iu;

// Public general-agro answers do not carry a governed, current pesticide-registration
// catalogue. Prescription-shaped chemical recommendations therefore fail closed: the
// assistant may explain integrated protection and ask for region/stage, but must not
// name an active ingredient/product as the user's treatment instruction.
export const CROP_PROTECTION_PRESCRIPTION_PRELUDE_PATTERN = /(?:применя\w*|использ\w*|обработ\w*|подойдут|рекоменду\w*|выбира\w*|назнач\w*|apply|use|choose|recommend|treat|使用|施用|选择|推荐)[^.!?。！？\n]{0,200}(?:препарат\w*|средств\w*|фунгицид\w*|гербицид\w*|инсектицид\w*|product|fungicide|herbicide|insecticide|药剂|杀菌剂)/iu;
export const UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_PATTERN = /(?:применя\w*|использ\w*|обработ\w*|подойдут|рекоменду\w*|выбира\w*|назнач\w*|apply|use|choose|recommend|treat|使用|施用|选择|推荐)[^.!?。！？\n]{0,160}(?:препарат\w*|средств\w*|фунгицид\w*|гербицид\w*|инсектицид\w*|product|fungicide|herbicide|insecticide|药剂|杀菌剂)[^.!?。！？\n]{0,120}(?:на\s+основе|с\s+содержани\w*|с\s+действующ\w*\s+веществ\w*|\bс\s+[\p{L}-]{4,}(?:\s+или\s+[\p{L}-]{4,})?|containing|active\s+ingredient|with\s+[A-Za-z][A-Za-z-]{3,}|有效成分|含有)/iu;

export function isUngroundedCropProtectionPrescription(block: string): boolean {
  return UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_PATTERN.test(block);
}

export function stripUngroundedCropProtectionPrescriptions(
  answer: string,
  safetyFlags?: string[],
): string {
  const filteredLines = answer.split('\n').map((line) => {
    if (!isUngroundedCropProtectionPrescription(line)) return line;
    const keptSentences = line
      .split(/(?<=[!?。！？])\s+|(?<!\d)(?<=\.)\s+/u)
      .filter((sentence) => {
        if (!isUngroundedCropProtectionPrescription(sentence)) return true;
        safetyFlags?.push('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
        return false;
      });
    return keptSentences.join(' ');
  });

  return filteredLines.join('\n').replace(/\n{3,}/gu, '\n\n').trim();
}

export function sanitizeAnswer(value: string): string {
  const cleaned = value
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]+\)/gu, '$1')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/```[\s\S]*?```/gu, (block) => block.replace(/```\w*/gu, '').replace(/```/gu, ''))
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/\*\*([^*]+)\*\*/gu, '$1')
    .replace(/__([^_]+)__/gu, '$1')
    .replace(/^\s*#{1,6}\s+/gmu, '')
    .replace(/^\s*\*\s+/gmu, '• ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
    .replace(/[ \t]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
    .slice(0, 12_000);

  return cleaned;
}

export function splitAnswerBlocks(value: string): string[] {
  return value.split(/(?<=[.!?。！？])\s+|\n+/u).map((part) => part.trim()).filter(Boolean);
}

export function normalizeForComparison(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е').replace(/\s+/gu, ' ').trim();
}

export function normalizeCompletenessText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е');
}

export function includesAny(value: string, terms: readonly string[]): boolean {
  return terms.some((term) => value.includes(normalizeCompletenessText(term)));
}

/** The authority text a verified-platform answer may not contradict or exceed. */
export function groundingAuthority(grounding: PublicGrounding): string {
  return normalizeForComparison(
    [grounding.title, grounding.answer, grounding.maturity, ...grounding.facts].join(' '),
  );
}

/**
 * Whether one block survives verified-platform grounding.
 *
 * Block-level by construction so the streaming gate can decide on a sentence the
 * moment it is complete, without waiting for the rest of the answer.
 */
export function platformGroundingVerdict(
  block: string,
  authority: string,
): { readonly keep: boolean; readonly flags: readonly string[] } {
  const normalized = normalizeForComparison(block);
  const flags: string[] = [];
  const unsupportedEntity = HIGH_RISK_ENTITY_PATTERNS.some(
    (pattern) => pattern.test(normalized) && !pattern.test(authority),
  );
  const unsupportedLiveClaim = LIVE_CAPABILITY_PATTERN.test(normalized) && !LIVE_CAPABILITY_PATTERN.test(authority);
  if (unsupportedEntity) flags.push('UNSUPPORTED_PLATFORM_ENTITY_REMOVED');
  if (unsupportedLiveClaim) flags.push('UNSUPPORTED_LIVE_CAPABILITY_REMOVED');
  return { keep: !unsupportedEntity && !unsupportedLiveClaim, flags };
}

export function enforcePlatformGrounding(
  answer: string,
  grounding: PublicGrounding,
  safetyFlags: string[],
): string {
  const authority = groundingAuthority(grounding);
  const kept: string[] = [];
  for (const block of splitAnswerBlocks(answer)) {
    const verdict = platformGroundingVerdict(block, authority);
    if (!verdict.keep) {
      safetyFlags.push(...verdict.flags);
      continue;
    }
    kept.push(block);
  }
  return kept.join('\n').trim();
}

/** Whether one block may stand when the question needs current, governed evidence. */
export function currentEvidenceVerdict(block: string): boolean {
  return !EXACT_CURRENT_CLAIM_PATTERN.test(block.replace(/^\s*\d+[.)]\s*/u, ''));
}

export function enforceCurrentEvidenceBoundary(
  answer: string,
  locale: PublicLocale,
  safetyFlags: string[],
): string {
  safetyFlags.push('CURRENT_EVIDENCE_REQUIRED');
  const stable = splitAnswerBlocks(answer).filter(currentEvidenceVerdict).join('\n').trim();
  const boundary = currentEvidenceCopy(locale);
  return stable ? `${boundary}\n\n${stable}` : boundary;
}

export function isPlantDiseasePreventionQuestion(value: string, locale: PublicLocale): boolean {
  const diseaseTerms = locale === 'en'
    ? ['scab', 'disease', 'fung', 'infection', 'blight', 'mildew', 'rust', 'leaf spot']
    : locale === 'zh'
      ? ['病', '霉', '锈', '斑', '感染']
      : ['парш', 'болезн', 'гриб', 'инфекц', 'фитофтор', 'мучнист', 'ржавчин', 'пятнист'];
  const preventionTerms = locale === 'en'
    ? ['prevent', 'reduce', 'risk', 'control', 'protect']
    : locale === 'zh'
      ? ['预防', '降低', '风险', '防治', '控制']
      : ['сниз', 'предотврат', 'профилакт', 'защит', 'риск', 'борот', 'контрол'];
  return includesAny(value, diseaseTerms) && includesAny(value, preventionTerms);
}

export function plantDiseaseFactorGroups(locale: PublicLocale): readonly (readonly string[])[] {
  if (locale === 'en') {
    return [
      ['sanitation', 'remove infected', 'fallen leaves', 'mummified fruit', 'crop residue', 'inoculum'],
      ['canopy', 'prun', 'airflow', 'dry faster', 'leaf wetness'],
      ['humidity', 'rain', 'rainfall', 'dew', 'temperature', 'weather'],
      ['monitor', 'inspect', 'growth stage', 'timing', 'forecast', 'disease history'],
      ['fungicide', 'registered product', 'label', 'crop protection', 'spray timing'],
    ];
  }
  if (locale === 'zh') {
    return [
      ['清园', '清除病叶', '落叶', '僵果', '病残体', '菌源'],
      ['树冠', '修剪', '通风', '叶面干燥', '叶片湿润时间'],
      ['湿度', '降雨', '露水', '温度', '天气'],
      ['监测', '检查', '生育期', '时机', '预报', '病史'],
      ['杀菌剂', '登记药剂', '标签', '植保', '施药时机'],
    ];
  }
  return [
    ['санитар', 'удал', 'убир', 'опавш', 'мумифиц', 'остатк', 'запас инфекции', 'источник инфекции'],
    ['крон', 'обрез', 'прореж', 'проветр', 'высых', 'увлажнение листьев', 'листовой влажности'],
    ['влажност', 'дожд', 'осад', 'рос', 'температур', 'погод'],
    ['монитор', 'осмотр', 'фаз', 'срок', 'прогноз', 'история болезни'],
    ['фунгиц', 'зарегистрирован', 'этикет', 'защита растений', 'срок обработки'],
  ];
}

export function plantDiseaseCompletenessFloor(locale: PublicLocale): string {
  if (locale === 'en') {
    return 'Add a prevention plan aimed at the disease cycle itself: remove infected fallen leaves, mummified fruit and other inoculum sources, and manage the canopy so foliage dries quickly after rain or dew. Assess risk from leaf-wetness duration, rainfall, temperature, disease history and crop growth stage. If chemical protection is needed, use only a product currently registered for the crop and location and follow its label; without location, growth stage and registration evidence, do not select a product, dose or interval.';
  }
  if (locale === 'zh') {
    return '还应建立针对病害循环的预防措施：清除病叶、落叶、僵果及其他菌源，并通过合理修剪和通风缩短雨后或露水后的叶片湿润时间。风险判断应结合叶片湿润持续时间、降雨、温度、既往病史和作物生育期。需要化学防治时，只能选择当地对该作物已登记的药剂并严格按标签使用；缺少地区、生育期和登记证据时，不应给出具体药剂、剂量或间隔。';
  }
  return 'Дополнительно нужен профилактический контур, направленный на цикл болезни: санитарная уборка поражённых опавших листьев, мумифицированных плодов и других источников инфекции, а также прореживание кроны, чтобы листва быстрее высыхала после дождя и росы. Риск оценивайте по длительности увлажнения листьев, осадкам, температуре, истории болезни в саду и фазе развития культуры. Если нужна фунгицидная обработка, выбирайте только зарегистрированный для культуры и региона препарат и действуйте строго по этикетке; без региона, фазы и подтверждённой регистрации нельзя безопасно назначать конкретный продукт, дозу или интервал.';
}

/**
 * Whether the finished answer already covers enough independent disease-control
 * factors. Deliberately end-of-answer: the floor exists precisely because the
 * whole answer was thin, so it cannot be judged from one block.
 */
export function needsDiseaseCompletenessFloor(
  answer: string,
  question: string,
  locale: PublicLocale,
): boolean {
  if (!isPlantDiseasePreventionQuestion(normalizeCompletenessText(question), locale)) return false;
  const normalizedAnswer = normalizeCompletenessText(answer);
  const matchedGroups = plantDiseaseFactorGroups(locale)
    .filter((group) => group.some((term) => normalizedAnswer.includes(normalizeCompletenessText(term))));
  return matchedGroups.length < 2;
}

export function verifiedFallback(grounding: PublicGrounding): string {
  return [grounding.answer, grounding.maturity].filter(Boolean).join('\n\n');
}

export function continuationInstruction(locale: PublicLocale): string {
  if (locale === 'en') return 'Continue exactly where the answer stopped. Do not repeat prior text. Finish in plain text.';
  if (locale === 'zh') return '从中断处继续，不要重复之前的内容，并用纯文本完整结束回答。';
  return 'Продолжи строго с места остановки, не повторяй предыдущий текст и закончи ответ обычным текстом.';
}

export function truncationCopy(locale: PublicLocale): string {
  if (locale === 'en') return 'The response reached the technical length limit. Ask for a specific section to continue.';
  if (locale === 'zh') return '回答已达到技术长度限制。请指定需要继续展开的部分。';
  return 'Ответ достиг технического ограничения по длине. Укажи раздел, который нужно продолжить.';
}

export function currentEvidenceCopy(locale: PublicLocale): string {
  if (locale === 'en') return 'I cannot confirm an exact current value without a governed source, publication date, geography and retrieval time. Below is the stable framework that can be used safely.';
  if (locale === 'zh') return '在没有受控来源、发布日期、地区和获取时间的情况下，我无法确认精确的当前数值。下面仅给出可安全使用的稳定分析框架。';
  return 'Я не могу подтвердить точное актуальное значение без управляемого источника, даты публикации, региона и времени получения. Ниже — только устойчивый практический ориентир.';
}

/** Raw links never reach the public contour, streamed or buffered. */
export function stripRawLinks(value: string): { readonly text: string; readonly removed: boolean } {
  const withoutLinks = value.replace(/(?:https?:\/\/|www\.)\S+/giu, '').replace(/[ \t]+\n/gu, '\n').trim();
  return { text: withoutLinks, removed: withoutLinks !== value };
}
