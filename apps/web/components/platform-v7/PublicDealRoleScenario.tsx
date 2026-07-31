'use client';

import { useMemo, useState } from 'react';
import { CircleDollarSign, FileCheck2, FlaskConical, MapPinned, ShieldAlert, UserRoundCheck } from 'lucide-react';
import styles from './PublicDealRoleScenario.module.css';

type Locale = 'ru' | 'en' | 'zh';
type RoleKey =
  | 'seller'
  | 'buyer'
  | 'logistics'
  | 'driver'
  | 'storage'
  | 'laboratory'
  | 'surveyor'
  | 'bank'
  | 'operator'
  | 'compliance'
  | 'arbitrator'
  | 'executive';

type RoleScenario = { label: string; risk: string; owner: string; next: string; evidence: string; money: string };
type UiCopy = {
  label: string;
  rolesLabel: string;
  note: string;
  preview: string;
  deal: string;
  status: string;
  stageLabel: string;
  stages: [string, string, string, string, string];
  route: string;
  routeValue: string;
  quality: string;
  qualityValue: string;
  documents: string;
  documentsValue: string;
  reserve: string;
  reserveValue: string;
  risk: string;
  owner: string;
  next: string;
  evidence: string;
  money: string;
};

const scenarios: Record<Locale, Record<RoleKey, RoleScenario>> = {
  ru: {
    seller: { label: 'Продавец', risk: 'Оплата остановлена из-за расхождения качества и неподписанного акта.', owner: 'Покупатель и лаборатория', next: 'Проверить проект акта и запросить подтверждение покупателя.', evidence: 'Протокол лаборатории, спецификация и акт расхождений.', money: 'Средства остаются зарезервированными; окончательная выплата остановлена.' },
    buyer: { label: 'Покупатель', risk: 'Фактическая влажность выше договорного допуска на 0,8 п.п.', owner: 'Лаборатория', next: 'Выбрать договорное правило перерасчёта и подписать акт.', evidence: 'Проба, лабораторный протокол и версия спецификации.', money: 'Резерв сохраняется до подтверждения нового основания расчёта.' },
    logistics: { label: 'Логистика', risk: 'Рейс завершён физически, но приёмка ещё не закрыта документально.', owner: 'Хранение и покупатель', next: 'Передать подтверждение рейса и дождаться закрытия приёмки.', evidence: 'ЭПД, отметки прибытия и весовые данные.', money: 'Расчёт за перевозку отделён от окончательного расчёта за товар.' },
    driver: { label: 'Водитель', risk: 'Прибытие подтверждено, но разгрузка и вес ещё не стали основанием приёмки.', owner: 'Площадка приёмки и оператор', next: 'Подтвердить ЭПД, геозону и передачу груза на весовую.', evidence: 'ЭПД, геозона, время прибытия и весовые события.', money: 'Оплата рейса зависит от подтверждённого завершения перевозки, а не от расчёта за товар.' },
    storage: { label: 'Элеватор', risk: 'Партия принята условно до решения по показателю качества.', owner: 'Лаборатория и покупатель', next: 'Зафиксировать размещение партии и режим условного хранения.', evidence: 'Акт приёмки, вес, место хранения и статус партии.', money: 'Основание передачи товара есть, основания окончательного расчёта пока нет.' },
    laboratory: { label: 'Лаборатория', risk: 'Результат вышел за допуск и должен быть связан с конкретной пробой.', owner: 'Лаборатория', next: 'Подтвердить протокол, методику и идентификатор пробы.', evidence: 'Проба → измерение → протокол → партия.', money: 'Результат влияет на формулу цены, но сам по себе не запускает выплату.' },
    surveyor: { label: 'Сюрвейер', risk: 'Стороны расходятся в трактовке качества; требуется независимое подтверждение.', owner: 'Сюрвейер', next: 'Проверить цепочку проба → методика → измерение → акт.', evidence: 'Идентификатор пробы, методика, фотофиксация и протокол.', money: 'Независимое заключение влияет на перерасчёт и границы возможного спора.' },
    bank: { label: 'Банк', risk: 'Основание для выплаты не подтверждено: правило перерасчёта не подписано.', owner: 'Покупатель и продавец', next: 'Сохранить резерв и ожидать подтверждённое событие Сделки.', evidence: 'Статусы приёмки, качества, подписей и версии расчёта.', money: 'Резервирование действует; выплата остановлена правилами Сделки.' },
    operator: { label: 'Оператор', risk: 'Сделка остановлена между лабораторией, покупателем и документным контуром.', owner: 'Оператор исполнения', next: 'Назначить владельца действия, срок и контрольную точку.', evidence: 'Лента событий, статусы ролей, документов и SLA.', money: 'Видит сумму под риском и не допускает выплату без основания.' },
    compliance: { label: 'Комплаенс', risk: 'Критический переход нельзя выполнять без полномочий, актуальной версии и полного основания.', owner: 'Комплаенс', next: 'Проверить роль, организацию, подписи и источник события.', evidence: 'Ролевой доступ, версия документа, КЭП и журнал действий.', money: 'Снижает риск несанкционированной выплаты и непрослеживаемого решения.' },
    arbitrator: { label: 'Арбитр', risk: 'Есть спор о качестве и перерасчёте; факты нельзя собирать вручную из разных систем.', owner: 'Арбитр', next: 'Сопоставить хронологию, версии документов и позиции сторон.', evidence: 'Неизменяемая лента событий, протоколы, акты и расчётные версии.', money: 'Показывает спорную сумму, применённое правило и последствия решения.' },
    executive: { label: 'Руководитель', risk: 'Локальное отклонение может стать системным узким местом по срокам и оборотному капиталу.', owner: 'Руководитель', next: 'Оценить повторяемость блокера и назначить процессное решение.', evidence: 'SLA, суммы под риском, частота отклонений и ответственные.', money: 'Показывает капитал в резерве, просрочку и влияние на маржу портфеля.' },
  },
  en: {
    seller: { label: 'Seller', risk: 'Payment is paused because quality differs from terms and the discrepancy act is unsigned.', owner: 'Buyer and laboratory', next: 'Review the prepared act and request buyer confirmation.', evidence: 'Laboratory protocol, specification and discrepancy act.', money: 'Funds remain reserved; final payout is paused.' },
    buyer: { label: 'Buyer', risk: 'Measured moisture is 0.8 percentage points above contractual tolerance.', owner: 'Laboratory', next: 'Select the recalculation rule and sign the act.', evidence: 'Sample, laboratory protocol and specification version.', money: 'The reserve remains until a revised settlement basis is confirmed.' },
    logistics: { label: 'Logistics', risk: 'The trip is physically complete, but acceptance is not closed in the documents.', owner: 'Storage and buyer', next: 'Submit trip evidence and wait for acceptance closure.', evidence: 'Electronic transport document, arrival marks and weight data.', money: 'Freight settlement is separated from final product settlement.' },
    driver: { label: 'Driver', risk: 'Arrival is confirmed, but unloading and weight are not yet acceptance evidence.', owner: 'Acceptance site and operator', next: 'Confirm the transport document, geofence and handover to weighing.', evidence: 'Transport document, geofence, arrival time and weight events.', money: 'Trip payment follows confirmed transport completion, not product settlement.' },
    storage: { label: 'Storage', risk: 'The lot is accepted conditionally pending a quality decision.', owner: 'Laboratory and buyer', next: 'Record lot placement and the conditional storage regime.', evidence: 'Acceptance act, weight, storage location and lot status.', money: 'Transfer evidence exists; the final settlement basis does not yet.' },
    laboratory: { label: 'Laboratory', risk: 'The result is outside tolerance and must be traceably linked to the sample.', owner: 'Laboratory', next: 'Confirm the protocol, method and sample identifier.', evidence: 'Sample → measurement → protocol → lot.', money: 'The result affects pricing but does not trigger payout by itself.' },
    surveyor: { label: 'Surveyor', risk: 'The parties interpret quality differently and need independent verification.', owner: 'Surveyor', next: 'Verify the sample → method → measurement → act chain.', evidence: 'Sample ID, method, photo evidence and protocol.', money: 'The independent conclusion affects recalculation and dispute boundaries.' },
    bank: { label: 'Bank', risk: 'The payout basis is not confirmed because the recalculation rule is unsigned.', owner: 'Buyer and seller', next: 'Keep funds reserved and wait for a confirmed Deal event.', evidence: 'Acceptance, quality, signature and calculation-version statuses.', money: 'The reservation remains active; Deal rules keep payout paused.' },
    operator: { label: 'Operator', risk: 'The Deal is stuck between the laboratory, buyer and document workflow.', owner: 'Execution operator', next: 'Assign the action owner, deadline and control point.', evidence: 'Event timeline, role, document and SLA statuses.', money: 'Shows the amount at risk and prevents payout without evidence.' },
    compliance: { label: 'Compliance', risk: 'A critical transition cannot proceed without authority, current version and full evidence.', owner: 'Compliance', next: 'Verify role, organisation, signatures and event source.', evidence: 'Role access, document version, digital signature and audit log.', money: 'Reduces unauthorised payout and untraceable-decision risk.' },
    arbitrator: { label: 'Arbitrator', risk: 'A quality and recalculation dispute cannot rely on facts gathered manually across systems.', owner: 'Arbitrator', next: 'Compare chronology, document versions and party positions.', evidence: 'Immutable event timeline, protocols, acts and calculation versions.', money: 'Shows the disputed amount, applied rule and decision consequences.' },
    executive: { label: 'Executive', risk: 'A local deviation may become a systemic bottleneck for time and working capital.', owner: 'Executive', next: 'Assess recurrence and assign a process-level correction.', evidence: 'SLA, amounts at risk, deviation frequency and owners.', money: 'Shows reserved capital, delay and portfolio-margin impact.' },
  },
  zh: {
    seller: { label: '卖方', risk: '因质量与约定不符且差异单未签署，付款已暂停。', owner: '买方与实验室', next: '检查已准备的差异单并请求买方确认。', evidence: '实验室报告、规格版本和差异单。', money: '资金保持预留，最终付款暂停。' },
    buyer: { label: '买方', risk: '实测水分比合同容差高 0.8 个百分点。', owner: '实验室', next: '选择合同重算规则并签署差异单。', evidence: '样品、实验室报告和规格版本。', money: '在新结算依据确认前保持资金预留。' },
    logistics: { label: '物流', risk: '运输已实际完成，但验收文件尚未关闭。', owner: '仓储与买方', next: '提交运输证明并等待验收关闭。', evidence: '电子运输文件、到达记录和称重数据。', money: '运费结算与商品最终结算分开处理。' },
    driver: { label: '司机', risk: '到达已确认，但卸货和重量尚未形成验收依据。', owner: '验收场地与运营方', next: '确认运输文件、地理围栏和交接称重。', evidence: '运输文件、地理围栏、到达时间和称重事件。', money: '运费取决于运输完成确认，而非商品结算。' },
    storage: { label: '仓储', risk: '该批次在质量决定前处于有条件接收状态。', owner: '实验室与买方', next: '记录批次位置和有条件仓储制度。', evidence: '验收单、重量、存放位置和批次状态。', money: '已有交接依据，但最终结算依据尚未形成。' },
    laboratory: { label: '实验室', risk: '结果超出容差，必须可追溯地关联到样品。', owner: '实验室', next: '确认报告、检测方法和样品标识。', evidence: '样品 → 测量 → 报告 → 批次。', money: '结果影响定价，但不会自行触发付款。' },
    surveyor: { label: '检验机构', risk: '双方对质量解释不一致，需要独立核验。', owner: '检验机构', next: '核验样品 → 方法 → 测量 → 记录链。', evidence: '样品标识、方法、照片和报告。', money: '独立结论影响重算与争议边界。' },
    bank: { label: '银行', risk: '重算规则未签署，因此付款依据尚未确认。', owner: '买方与卖方', next: '保持资金预留并等待已确认的交易事件。', evidence: '验收、质量、签名和计算版本状态。', money: '预留保持有效；交易规则使付款继续暂停。' },
    operator: { label: '运营方', risk: '交易停在实验室、买方与文件流程之间。', owner: '执行运营方', next: '指定行动负责人、截止时间和控制点。', evidence: '事件时间线、角色、文件和 SLA 状态。', money: '显示风险金额，并阻止无依据付款。' },
    compliance: { label: '合规', risk: '缺少权限、最新版本或完整依据时，关键流转不得执行。', owner: '合规', next: '核验角色、机构、签名与事件来源。', evidence: '角色访问、文件版本、电子签名和审计日志。', money: '降低未经授权付款和不可追溯决策风险。' },
    arbitrator: { label: '仲裁方', risk: '质量与重算争议不能依赖从不同系统手工收集的事实。', owner: '仲裁方', next: '比对时间线、文件版本与双方立场。', evidence: '不可变事件时间线、报告、记录与计算版本。', money: '显示争议金额、适用规则和决定后果。' },
    executive: { label: '管理者', risk: '局部偏差可能演变为时效与营运资金的系统瓶颈。', owner: '管理者', next: '评估重复性并制定流程级修正。', evidence: 'SLA、风险金额、偏差频率和责任方。', money: '显示预留资金、延误和组合利润影响。' },
  },
};

const ui: Record<Locale, UiCopy> = {
  ru: {
    label: 'Сделка глазами каждой роли', rolesLabel: 'Что видит каждый участник',
    note: 'Одна Сделка показывает данные, ответственность, действие, основание и денежное последствие каждой роли.',
    preview: 'Рабочее пространство Сделки', deal: 'Подсолнечник · 1 200 т', status: 'Отклонение качества',
    stageLabel: 'Этапы исполнения Сделки', stages: ['Рейс', 'Прибытие', 'Вес', 'Лаборатория', 'Расчёт'],
    route: 'Логистика', routeValue: 'Рейс завершён · геозона подтверждена', quality: 'Лаборатория', qualityValue: 'Влажность · +0,8 п.п. к допуску',
    documents: 'Документы', documentsValue: '5 из 6 подтверждены', reserve: 'Деньги', reserveValue: 'Средства зарезервированы',
    risk: 'Причина остановки', owner: 'Ответственный', next: 'Следующее действие', evidence: 'Основание', money: 'Денежное последствие',
  },
  en: {
    label: 'The Deal from every role', rolesLabel: 'What each participant sees',
    note: 'One Deal shows each role’s data, responsibility, action, evidence and monetary consequence.',
    preview: 'Deal workspace', deal: 'Sunflower lot · 1,200 t', status: 'Quality deviation',
    stageLabel: 'Deal execution stages', stages: ['Trip', 'Arrival', 'Weight', 'Laboratory', 'Settlement'],
    route: 'Logistics', routeValue: 'Trip complete · geofence confirmed', quality: 'Laboratory', qualityValue: 'Moisture · +0.8 pp above tolerance',
    documents: 'Documents', documentsValue: '5 of 6 confirmed', reserve: 'Money', reserveValue: 'Funds reserved',
    risk: 'Reason for pause', owner: 'Owner', next: 'Next action', evidence: 'Evidence', money: 'Monetary consequence',
  },
  zh: {
    label: '从每个角色查看交易', rolesLabel: '各参与方看到的内容',
    note: '同一笔交易显示每个角色的数据、责任、操作、依据与资金后果。',
    preview: '交易工作空间', deal: '葵花籽批次 · 1,200 吨', status: '质量偏差',
    stageLabel: '交易执行阶段', stages: ['运输', '到达', '称重', '实验室', '结算'],
    route: '物流', routeValue: '运输完成 · 地理围栏已确认', quality: '实验室', qualityValue: '水分 · 超出容差 0.8 个百分点',
    documents: '文件', documentsValue: '6 份中 5 份已确认', reserve: '资金', reserveValue: '资金已预留',
    risk: '暂停原因', owner: '责任方', next: '下一步', evidence: '依据', money: '资金后果',
  },
};

export function PublicDealRoleScenario({ locale }: { locale: string }) {
  const normalized: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const [role, setRole] = useState<RoleKey>('buyer');
  const copy = ui[normalized];
  const selected = useMemo(() => scenarios[normalized][role], [normalized, role]);

  return (
    <div className={styles.root}>
      <div className={styles.heading}><strong>{copy.label}</strong><span>{copy.note}</span></div>
      <section className={styles.workspace} aria-label={copy.preview}>
        <div className={styles.workspaceHeader}><div><small>{copy.preview}</small><strong>{copy.deal}</strong></div><span>{copy.status}</span></div>
        <div className={styles.stageRail} role='list' aria-label={copy.stageLabel}>
          {copy.stages.map((stage, index) => (
            <div key={stage} role='listitem' className={index < 3 ? styles.done : index === 3 ? styles.activeStage : undefined}>
              <i aria-hidden='true' /><span>{stage}</span>
            </div>
          ))}
        </div>
        <div className={styles.metrics}>
          <article><MapPinned aria-hidden='true' /><div><span>{copy.route}</span><strong>{copy.routeValue}</strong></div></article>
          <article><FlaskConical aria-hidden='true' /><div><span>{copy.quality}</span><strong>{copy.qualityValue}</strong></div></article>
          <article><FileCheck2 aria-hidden='true' /><div><span>{copy.documents}</span><strong>{copy.documentsValue}</strong></div></article>
          <article><CircleDollarSign aria-hidden='true' /><div><span>{copy.reserve}</span><strong>{copy.reserveValue}</strong></div></article>
        </div>
        <div className={styles.tabs} role='tablist' aria-label={copy.rolesLabel}>
          {(Object.keys(scenarios[normalized]) as RoleKey[]).map((key) => (
            <button key={key} type='button' role='tab' aria-selected={role === key} className={role === key ? styles.active : undefined} onClick={() => setRole(key)}>
              {scenarios[normalized][key].label}
            </button>
          ))}
        </div>
        <div className={styles.rolePanel} role='tabpanel' aria-live='polite'>
          <article className={styles.alert}><ShieldAlert aria-hidden='true' /><div><span>{copy.risk}</span><strong>{selected.risk}</strong></div></article>
          <div className={styles.actionGrid}>
            <article><UserRoundCheck aria-hidden='true' /><div><span>{copy.owner}</span><strong>{selected.owner}</strong></div></article>
            <article><FileCheck2 aria-hidden='true' /><div><span>{copy.next}</span><strong>{selected.next}</strong></div></article>
          </div>
          <div className={styles.contextRow}>
            <span><FileCheck2 aria-hidden='true' /><b>{copy.evidence}:</b> {selected.evidence}</span>
            <span><CircleDollarSign aria-hidden='true' /><b>{copy.money}:</b> {selected.money}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
