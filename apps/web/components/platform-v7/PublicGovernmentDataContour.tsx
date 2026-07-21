'use client';

import * as React from 'react';
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FlaskConical,
  LandPlot,
  Network,
  Sprout,
  Truck,
  Wheat,
} from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';
import { PublicGovernmentSourceResult, type PublicGovernmentSource } from './PublicGovernmentSourceResult';

type Locale = 'ru' | 'en' | 'zh';

type SourceCode = 'grain' | 'land' | 'seed' | 'saturn' | 'argus' | 'accreditation' | 'epd' | 'vetis';

type SourceCopy = Omit<PublicGovernmentSource, 'code'>;

const COPY = {
  ru: {
    eyebrow: 'Государственный контур данных',
    title: 'Сделка сверяется с государственными основаниями',
    lead: 'Платформа связывает происхождение продукции, поля, семена, применение средств, фитосанитарные документы, лаборатории и перевозочные основания в одной доказательной истории.',
    note: 'Доступность источника определяется официальным подключением организации и текущим статусом интеграции.',
    deal: 'Карточка сделки',
    demo: 'Публичный контур без доступа к данным организаций',
    previous: 'Предыдущий источник',
    next: 'Следующий источник',
    sources: {
      grain: { name: 'ФГИС «Зерно»', checks: 'Партия, СДИЗ, масса, отправитель, получатель и статус операции', capability: 'Сопоставление партии платформы с официальной записью', impact: 'После официального подключения расхождение может блокировать приёмку или расчёт.', integrationMode: 'OFFICIAL_API', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: 'Требуется подключение организации', freshness: 'Текущая проверка не выполнялась', limitation: 'Нельзя показывать положительный результат до получения официального доступа и ответа адаптера.' },
      land: { name: 'ЕФГИС ЗСН', checks: 'Поле, геометрия, площадь, землепользователь, культура и сезон', capability: 'Проверка происхождения продукции и связи партии с полем', impact: 'После подключения отсутствие поля или расхождение культуры требует исправления до передачи данных дальше.', integrationMode: 'OFFICIAL_API / VERIFIED_IMPORT', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: 'Требуется подключение организации', freshness: 'Текущая проверка не выполнялась', limitation: 'Допускается только официальный API или подтверждённый импорт.' },
      seed: { name: 'ФГИС «Семеноводство»', checks: 'Культура, сорт, категория, партия, объём, участники и документы качества', capability: 'Проверка происхождения семенного материала и статуса сделки', impact: 'Неподтверждённая запись или отсутствие документов требует внимания участника.', integrationMode: 'OFFICIAL_ACCESS_REQUIRED / VERIFIED_IMPORT', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: 'Требуется документированный доступ', freshness: 'Текущая проверка не выполнялась', limitation: 'Прямая API-интеграция не заявляется без документированного интерфейса.' },
      saturn: { name: 'ФГИС «Сатурн»', checks: 'Средство, партия, поле, культура, дата, норма и операция применения', capability: 'Сопоставление поля и культуры, проверка последовательности операций', impact: 'После подтверждённого импорта возможное несоответствие становится риском доказательной истории.', integrationMode: 'OFFICIAL_ACCESS_REQUIRED', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: 'Требуется официальное предоставление интерфейса', freshness: 'Текущая проверка не выполнялась', limitation: 'Screen scraping запрещён; допускаются официальный экспорт, подписанный документ или ручная привязка.' },
      argus: { name: 'ФГИС «Аргус-Фито»', checks: 'Фитосанитарные документы, акты контроля, заключения и карантинные зоны', capability: 'Публичная проверка подлинности документа и его статуса', impact: 'Недействительный или отсутствующий документ может ограничить маршрут и приёмку.', integrationMode: 'PUBLIC_REGISTRY / OFFICIAL_ACCESS_REQUIRED', status: 'PUBLIC_REGISTRY', statusLabel: 'Доступна публичная проверка', freshness: 'Проверка конкретного документа не выполнялась', limitation: 'Действия от имени организации требуют официального доступа; пароли ЕСИА не передаются TAI.' },
      accreditation: { name: 'Росаккредитация', checks: 'Статус лаборатории, область аккредитации, сертификат или декларация', capability: 'Проверка действующего статуса и соответствия области исследования', impact: 'Приостановление или несоответствие области влияет на доказательную силу протокола.', integrationMode: 'PUBLIC_REGISTRY / OFFICIAL_EXTRACT', status: 'PUBLIC_REGISTRY', statusLabel: 'Доступна публичная проверка', freshness: 'Проверка конкретной лаборатории не выполнялась', limitation: 'TAI не выполняет запись в реестры; сохраняется только проверяемая выписка или ссылка.' },
      epd: { name: 'ГИС ЭПД', checks: 'Транспортная накладная, участники, груз, масса, маршрут и подписи', capability: 'Сверка перевозочных оснований с карточкой сделки и ФГИС «Зерно»', impact: 'Расхождение перевозочных данных требует сверки до приёмки и расчёта.', integrationMode: 'ACCREDITED_OPERATOR_API', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: 'Требуется подключение через аккредитованного оператора', freshness: 'Текущая проверка не выполнялась', limitation: 'Прямое подключение платформы к государственной системе не проектируется.' },
      vetis: { name: 'ВетИС · при применимости', checks: 'Только подконтрольные категории: корма, добавки и иные применимые товары', capability: 'Взаимодействие с компонентами ВетИС для релевантных сценариев', impact: 'Не применяется ко всем растениеводческим сделкам по умолчанию.', integrationMode: 'CONDITIONAL_OFFICIAL_API', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: 'Требуется проверка применимости и официальный доступ', freshness: 'Текущая проверка не выполнялась', limitation: 'Источник включается только для реально подконтрольной продукции.' },
    } satisfies Record<SourceCode, SourceCopy>,
  },
  en: {
    eyebrow: 'Government data contour',
    title: 'The deal is reconciled with official grounds',
    lead: 'The platform connects product origin, fields, seeds, inputs, phytosanitary documents, laboratories, and transport grounds in one evidence history.',
    note: 'Source availability depends on the organisation’s official connection and current integration status.',
    deal: 'Deal card',
    demo: 'Public contour with no organisation data access',
    previous: 'Previous source',
    next: 'Next source',
    sources: {
      grain: { name: 'FGIS Grain', checks: 'Lot, SDIZ, weight, sender, recipient, and operation status', capability: 'Reconcile the platform lot with the official record', impact: 'After official connection, a discrepancy may block acceptance or settlement.', integrationMode: 'OFFICIAL_API', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: 'Organisation connection required', freshness: 'No current check performed', limitation: 'A positive result must not be shown before official access and an adapter response.' },
      land: { name: 'EFGIS agricultural land', checks: 'Field, geometry, area, user, crop, and season', capability: 'Check product origin and lot-to-field linkage', impact: 'After connection, a missing field or crop mismatch requires correction.', integrationMode: 'OFFICIAL_API / VERIFIED_IMPORT', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: 'Organisation connection required', freshness: 'No current check performed', limitation: 'Only an official API or verified import is allowed.' },
      seed: { name: 'FGIS Seed production', checks: 'Crop, variety, category, lot, volume, parties, and quality documents', capability: 'Check seed origin and transaction status', impact: 'An unconfirmed record or missing document needs participant attention.', integrationMode: 'OFFICIAL_ACCESS_REQUIRED / VERIFIED_IMPORT', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: 'Documented access required', freshness: 'No current check performed', limitation: 'No direct API claim without a documented interface.' },
      saturn: { name: 'FGIS Saturn', checks: 'Product, lot, field, crop, date, rate, and application operation', capability: 'Reconcile field and crop and check operation sequence', impact: 'A confirmed mismatch becomes an evidence risk.', integrationMode: 'OFFICIAL_ACCESS_REQUIRED', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: 'Official interface required', freshness: 'No current check performed', limitation: 'Screen scraping is prohibited; only official export, signed document, or operator binding is allowed.' },
      argus: { name: 'FGIS Argus-Fito', checks: 'Phytosanitary documents, control acts, findings, and quarantine zones', capability: 'Public authenticity and status check', impact: 'An invalid or missing document may restrict route and acceptance.', integrationMode: 'PUBLIC_REGISTRY / OFFICIAL_ACCESS_REQUIRED', status: 'PUBLIC_REGISTRY', statusLabel: 'Public verification available', freshness: 'No specific document checked', limitation: 'Organisation actions require official access; TAI never receives ESIA passwords.' },
      accreditation: { name: 'Federal Accreditation Service', checks: 'Laboratory status, scope, certificate, or declaration', capability: 'Check active status and research scope', impact: 'Suspension or scope mismatch affects evidential value.', integrationMode: 'PUBLIC_REGISTRY / OFFICIAL_EXTRACT', status: 'PUBLIC_REGISTRY', statusLabel: 'Public verification available', freshness: 'No specific laboratory checked', limitation: 'TAI does not write to registries; only a verifiable extract or link is stored.' },
      epd: { name: 'Electronic transport documents', checks: 'Transport note, parties, cargo, weight, route, and signatures', capability: 'Reconcile transport grounds with the deal card and FGIS Grain', impact: 'A transport discrepancy requires review before acceptance and settlement.', integrationMode: 'ACCREDITED_OPERATOR_API', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: 'Accredited operator connection required', freshness: 'No current check performed', limitation: 'Direct platform connection to the state system is not designed.' },
      vetis: { name: 'VetIS · when applicable', checks: 'Only controlled categories such as feed, additives, and applicable goods', capability: 'Use VetIS components for relevant scenarios', impact: 'Not applied to every crop transaction by default.', integrationMode: 'CONDITIONAL_OFFICIAL_API', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: 'Applicability review and official access required', freshness: 'No current check performed', limitation: 'Enabled only for actually controlled products.' },
    } satisfies Record<SourceCode, SourceCopy>,
  },
  zh: {
    eyebrow: '政府数据链路',
    title: '交易与政府依据进行核对',
    lead: '平台把产品来源、田块、种子、投入品、植物检疫文件、实验室和运输依据连接成一条证据链。',
    note: '具体来源是否可用，取决于组织的正式连接和当前集成状态。',
    deal: '交易卡',
    demo: '公开链路，不访问组织数据',
    previous: '上一个来源',
    next: '下一个来源',
    sources: {
      grain: { name: 'FGIS 粮食', checks: '批次、SDIZ、重量、发件人、收件人和操作状态', capability: '将平台批次与官方记录进行核对', impact: '正式连接后，差异可能阻塞验收或结算。', integrationMode: 'OFFICIAL_API', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: '需要组织正式连接', freshness: '尚未执行当前检查', limitation: '在获得正式访问和适配器响应前，不得显示正面结果。' },
      land: { name: '农业用地 EFGIS', checks: '田块、几何、面积、使用者、作物和季节', capability: '检查产品来源和批次与田块的关联', impact: '连接后，缺失田块或作物不一致需要修正。', integrationMode: 'OFFICIAL_API / VERIFIED_IMPORT', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: '需要组织正式连接', freshness: '尚未执行当前检查', limitation: '只允许官方 API 或已验证导入。' },
      seed: { name: 'FGIS 种业', checks: '作物、品种、类别、批次、数量、参与方和质量文件', capability: '检查种子来源和交易状态', impact: '未确认记录或缺失文件需要参与方处理。', integrationMode: 'OFFICIAL_ACCESS_REQUIRED / VERIFIED_IMPORT', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: '需要有文档的正式访问', freshness: '尚未执行当前检查', limitation: '没有正式接口文档时不得宣称直接 API 集成。' },
      saturn: { name: 'FGIS Saturn', checks: '投入品、批次、田块、作物、日期、用量和使用操作', capability: '核对田块、作物和操作顺序', impact: '已确认的差异会成为证据风险。', integrationMode: 'OFFICIAL_ACCESS_REQUIRED', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: '需要官方接口', freshness: '尚未执行当前检查', limitation: '禁止屏幕抓取；只允许官方导出、签名文件或操作员关联。' },
      argus: { name: 'FGIS Argus-Fito', checks: '植物检疫文件、检查记录、结论和隔离区', capability: '公开验证文件真实性和状态', impact: '无效或缺失文件可能限制路线和验收。', integrationMode: 'PUBLIC_REGISTRY / OFFICIAL_ACCESS_REQUIRED', status: 'PUBLIC_REGISTRY', statusLabel: '可进行公开验证', freshness: '尚未检查具体文件', limitation: '代表组织的操作需要正式访问；TAI 不接收 ESIA 密码。' },
      accreditation: { name: '俄罗斯联邦认可署', checks: '实验室状态、认可范围、证书或声明', capability: '检查有效状态和研究范围', impact: '暂停或范围不符会影响证据效力。', integrationMode: 'PUBLIC_REGISTRY / OFFICIAL_EXTRACT', status: 'PUBLIC_REGISTRY', statusLabel: '可进行公开验证', freshness: '尚未检查具体实验室', limitation: 'TAI 不写入登记系统，只保存可核验的摘录或链接。' },
      epd: { name: '电子运输文件系统', checks: '运输单、参与方、货物、重量、路线和签名', capability: '将运输依据与交易卡和 FGIS 粮食核对', impact: '运输数据差异需要在验收和结算前处理。', integrationMode: 'ACCREDITED_OPERATOR_API', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: '需要通过认可运营商连接', freshness: '尚未执行当前检查', limitation: '不设计平台直接连接国家系统。' },
      vetis: { name: 'VetIS · 适用时', checks: '仅限饲料、添加剂和其他受控类别', capability: '在相关场景中使用 VetIS 组件', impact: '默认不适用于所有种植业交易。', integrationMode: 'CONDITIONAL_OFFICIAL_API', status: 'OFFICIAL_ACCESS_REQUIRED', statusLabel: '需要确认适用性并获得正式访问', freshness: '尚未执行当前检查', limitation: '只对实际受监管产品启用。' },
    } satisfies Record<SourceCode, SourceCopy>,
  },
} as const;

const ICONS = {
  grain: Wheat,
  land: LandPlot,
  seed: Sprout,
  saturn: FlaskConical,
  argus: FileCheck2,
  accreditation: BadgeCheck,
  epd: Truck,
  vetis: Network,
} as const;

const ORDER = Object.keys(ICONS) as SourceCode[];

export function PublicGovernmentDataContour({ locale }: { locale: string }) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const copy = COPY[localeKey];
  const [activeCode, setActiveCode] = React.useState<SourceCode>('grain');
  const ref = React.useRef<HTMLElement>(null);
  const source: PublicGovernmentSource = { code: activeCode, ...copy.sources[activeCode] };

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let sent = false;
    const observer = new IntersectionObserver((entries) => {
      if (sent || !entries.some((entry) => entry.isIntersecting)) return;
      sent = true;
      trackEvent('government_contour_seen', { locale: localeKey, dataMode: 'public_status_only' });
      observer.disconnect();
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [localeKey]);

  const select = (code: SourceCode) => {
    setActiveCode(code);
    trackEvent('government_system_selected', { systemCode: code, locale: localeKey, status: copy.sources[code].status });
  };

  const move = (direction: -1 | 1) => {
    const index = ORDER.indexOf(activeCode);
    select(ORDER[(index + direction + ORDER.length) % ORDER.length]);
  };

  return (
    <section ref={ref} id='government-data' className='pc-ppe-section pc-public-government-section' aria-labelledby='pc-public-government-title'>
      <div className='pc-ppe-section-header'>
        <span className='pc-ppe-section-eyebrow'>{copy.eyebrow}</span>
        <h2 id='pc-public-government-title'>{copy.title}</h2>
        <p>{copy.lead}</p>
        <small>{copy.note}</small>
      </div>
      <div className='pc-public-government-layout'>
        <div className='pc-public-government-map' aria-label={copy.title}>
          <div className='pc-public-government-controls'>
            <button type='button' onClick={() => move(-1)} aria-label={copy.previous}><ChevronLeft size={19} /></button>
            <span>{copy.demo}</span>
            <button type='button' onClick={() => move(1)} aria-label={copy.next}><ChevronRight size={19} /></button>
          </div>
          <div className='pc-public-government-source-grid' role='tablist' aria-label={copy.title}>
            {ORDER.map((code) => {
              const Icon = ICONS[code];
              const item = copy.sources[code];
              return (
                <button
                  key={code}
                  type='button'
                  role='tab'
                  aria-selected={activeCode === code}
                  aria-controls='pc-public-government-source-result'
                  data-active={activeCode === code ? 'true' : 'false'}
                  data-status={item.status}
                  onClick={() => select(code)}
                >
                  <Icon size={19} aria-hidden='true' />
                  <span>{item.name}</span>
                  <small>{item.statusLabel}</small>
                </button>
              );
            })}
          </div>
          <div className='pc-public-government-deal-node'>
            <span aria-hidden='true'><Network size={21} /></span>
            <strong>{copy.deal}</strong>
            <small>{copy.sources[activeCode].capability}</small>
          </div>
        </div>
        <div id='pc-public-government-source-result' role='tabpanel'>
          <PublicGovernmentSourceResult source={source} locale={localeKey} />
        </div>
      </div>
    </section>
  );
}
