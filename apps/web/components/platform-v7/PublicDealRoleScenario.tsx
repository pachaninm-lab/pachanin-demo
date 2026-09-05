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
  | 'employee';

type RoleScenario = {
  label: string;
  risk: string;
  owner: string;
  next: string;
  evidence: string;
  money: string;
};

type UiCopy = {
  label: string;
  rolesLabel: string;
  note: string;
  preview: string;
  deal: string;
  status: string;
  stageLabel: string;
  stages: [string, string, string, string, string, string, string];
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
    seller: {
      label: 'Продавец',
      risk: 'Поставка принята, но окончательный расчёт зависит от подтверждённого качества и документов.',
      owner: 'Продавец и покупатель',
      next: 'Проверить комплект документов и основание расчёта.',
      evidence: 'Условия Сделки, вес, приёмка, протокол качества и документы.',
      money: 'Видно, что уже подтверждено и что ещё удерживает окончательный расчёт.',
    },
    buyer: {
      label: 'Покупатель',
      risk: 'Нужно убедиться, что фактическая поставка соответствует условиям до подтверждения расчёта.',
      owner: 'Покупатель',
      next: 'Проверить приёмку, качество и комплектность документов.',
      evidence: 'Вес, качество, версия спецификации, акты и подтверждения.',
      money: 'Расчёт опирается на подтверждённое исполнение, а не на отдельную переписку.',
    },
    logistics: {
      label: 'Логистика',
      risk: 'Рейс должен быть связан с конкретной партией, маршрутом и приёмкой.',
      owner: 'Логистика',
      next: 'Подтвердить рейс и передать фактические события доставки.',
      evidence: 'Маршрут, транспорт, отметки прибытия, ЭПД и весовые события.',
      money: 'Стоимость перевозки и её основание отделены от расчёта за товар.',
    },
    driver: {
      label: 'Водитель',
      risk: 'Нужно подтвердить доставку без лишних действий и доступа к чужим данным.',
      owner: 'Водитель',
      next: 'Подтвердить прибытие и передачу груза в точке приёмки.',
      evidence: 'Рейс, время, геозона и перевозочные документы.',
      money: 'Основание выполнения рейса фиксируется отдельно от коммерческих условий товара.',
    },
    storage: {
      label: 'Элеватор / хранение',
      risk: 'Партия должна быть принята, взвешена и размещена с понятным статусом.',
      owner: 'Элеватор / площадка хранения',
      next: 'Зафиксировать приёмку, вес, размещение и состояние партии.',
      evidence: 'Вес, акт приёмки, место хранения и статус партии.',
      money: 'Подтверждённая приёмка становится частью основания дальнейшего расчёта.',
    },
    laboratory: {
      label: 'Лаборатория',
      risk: 'Результат качества должен быть прослеживаемо связан с конкретной пробой и партией.',
      owner: 'Лаборатория',
      next: 'Подтвердить методику, результат и протокол.',
      evidence: 'Проба → измерение → протокол → партия.',
      money: 'Показатель качества может влиять на цену, но сам по себе не запускает выплату.',
    },
    surveyor: {
      label: 'Сюрвейер',
      risk: 'Независимая проверка должна опираться на ту же версию фактов, что и стороны Сделки.',
      owner: 'Сюрвейер',
      next: 'Проверить цепочку доказательств и зафиксировать независимое заключение.',
      evidence: 'Проба, методика, фотофиксация, акты и протоколы.',
      money: 'Заключение становится доказательством для перерасчёта или спора, но не заменяет решение сторон.',
    },
    bank: {
      label: 'Банк / финансы',
      risk: 'Финансовое действие нельзя считать готовым без подтверждённого основания Сделки.',
      owner: 'Уполномоченный финансовый участник',
      next: 'Проверить подтверждённое основание и статус финансового сценария.',
      evidence: 'Статусы приёмки, качества, документов, решений и расчётной версии.',
      money: 'Платформа показывает основание и статус; движение денег подтверждает финансовый контур.',
    },
    employee: {
      label: 'Сотрудник платформы',
      risk: 'Если Сделка остановилась, нужно быстро понять причину, ответственного, полномочия и срок.',
      owner: 'Оператор / контроль платформы',
      next: 'Назначить ответственного, проверить основание и довести исключение до разрешённого следующего шага.',
      evidence: 'Лента событий, роли, версии документов, SLA и журнал решений.',
      money: 'Сотрудник видит денежное последствие, но не получает права участника Сделки автоматически.',
    },
  },
  en: {
    seller: { label: 'Seller', risk: 'Delivery is accepted, while final settlement still depends on verified quality and documents.', owner: 'Seller and buyer', next: 'Check the document set and settlement basis.', evidence: 'Deal terms, weight, acceptance, quality protocol and documents.', money: 'Shows what is confirmed and what still blocks final settlement.' },
    buyer: { label: 'Buyer', risk: 'The actual delivery must match the agreed terms before settlement is confirmed.', owner: 'Buyer', next: 'Check acceptance, quality and document completeness.', evidence: 'Weight, quality, specification version, acts and confirmations.', money: 'Settlement relies on verified execution rather than separate correspondence.' },
    logistics: { label: 'Logistics', risk: 'The trip must stay linked to the exact lot, route and acceptance event.', owner: 'Logistics', next: 'Confirm the trip and submit actual delivery events.', evidence: 'Route, vehicle, arrival marks, transport documents and weight events.', money: 'Freight basis remains separate from product settlement.' },
    driver: { label: 'Driver', risk: 'Delivery must be confirmed with minimal actions and without access to unrelated data.', owner: 'Driver', next: 'Confirm arrival and handover at the acceptance point.', evidence: 'Trip, time, geofence and transport documents.', money: 'Trip completion evidence is recorded separately from product commercial terms.' },
    storage: { label: 'Elevator / storage', risk: 'The lot must be received, weighed and placed with an explicit status.', owner: 'Elevator / storage site', next: 'Record acceptance, weight, placement and lot state.', evidence: 'Weight, acceptance act, storage location and lot status.', money: 'Verified acceptance becomes part of the basis for later settlement.' },
    laboratory: { label: 'Laboratory', risk: 'A quality result must be traceably linked to the exact sample and lot.', owner: 'Laboratory', next: 'Confirm the method, result and protocol.', evidence: 'Sample → measurement → protocol → lot.', money: 'Quality may affect price but does not trigger payout by itself.' },
    surveyor: { label: 'Surveyor', risk: 'Independent verification must use the same version of facts as the Deal parties.', owner: 'Surveyor', next: 'Verify the evidence chain and record the independent conclusion.', evidence: 'Sample, method, photo evidence, acts and protocols.', money: 'The conclusion becomes evidence for recalculation or dispute without replacing party authority.' },
    bank: { label: 'Bank / finance', risk: 'A financial action is not ready without a confirmed Deal basis.', owner: 'Authorised financial participant', next: 'Verify the confirmed basis and financial-scenario status.', evidence: 'Acceptance, quality, document, decision and calculation-version statuses.', money: 'The platform shows the basis and status; the financial circuit confirms money movement.' },
    employee: { label: 'Platform employee', risk: 'When a Deal stops, staff need the cause, owner, authority and deadline immediately.', owner: 'Platform operations / control', next: 'Assign the owner, verify the basis and move the exception to the next permitted step.', evidence: 'Event timeline, roles, document versions, SLA and decision log.', money: 'Staff see the monetary consequence without inheriting a Deal participant’s authority.' },
  },
  zh: {
    seller: { label: '卖方', risk: '交付已验收，但最终结算仍取决于已确认的质量和文件。', owner: '卖方与买方', next: '检查文件完整性和结算依据。', evidence: '交易条件、重量、验收、质量报告和文件。', money: '清楚显示哪些已确认、哪些仍阻止最终结算。' },
    buyer: { label: '买方', risk: '确认结算前，需要核对实际交付是否符合约定条件。', owner: '买方', next: '检查验收、质量和文件完整性。', evidence: '重量、质量、规格版本、记录和确认。', money: '结算依据来自已确认履约，而不是分散沟通。' },
    logistics: { label: '物流', risk: '运输任务必须与具体批次、路线和验收事件保持关联。', owner: '物流', next: '确认运输并提交实际交付事件。', evidence: '路线、车辆、到达记录、运输文件和称重事件。', money: '运费依据与商品结算保持分离。' },
    driver: { label: '司机', risk: '司机应以最少操作确认交付，且不能访问无关数据。', owner: '司机', next: '确认到达并在验收点完成货物交接。', evidence: '运输任务、时间、地理围栏和运输文件。', money: '运输完成依据与商品商业条件分开记录。' },
    storage: { label: '筒仓 / 仓储', risk: '批次需要完成验收、称重和入库，并具有明确状态。', owner: '筒仓 / 仓储点', next: '记录验收、重量、存放位置和批次状态。', evidence: '重量、验收记录、存放位置和批次状态。', money: '已确认验收成为后续结算依据的一部分。' },
    laboratory: { label: '实验室', risk: '质量结果必须可追溯地关联到具体样品和批次。', owner: '实验室', next: '确认检测方法、结果和报告。', evidence: '样品 → 测量 → 报告 → 批次。', money: '质量指标可以影响价格，但不会自行触发付款。' },
    surveyor: { label: '检验机构', risk: '独立核验必须使用与交易双方一致的事实版本。', owner: '检验机构', next: '核验证据链并记录独立结论。', evidence: '样品、方法、照片、记录和报告。', money: '结论可作为重算或争议证据，但不替代双方权限。' },
    bank: { label: '银行 / 金融', risk: '没有已确认的交易依据，金融动作不能视为就绪。', owner: '获授权的金融参与方', next: '核对已确认依据和金融场景状态。', evidence: '验收、质量、文件、决定和计算版本状态。', money: '平台显示依据和状态；资金实际流动由金融系统确认。' },
    employee: { label: '平台员工', risk: '交易停滞时，需要立即明确原因、责任方、权限和期限。', owner: '平台运营 / 控制', next: '指定责任方、核对依据，并把异常推进到允许的下一步。', evidence: '事件时间线、角色、文件版本、SLA 和决定日志。', money: '员工可查看资金影响，但不会自动获得交易参与方权限。' },
  },
};

const ui: Record<Locale, UiCopy> = {
  ru: {
    label: 'Сделка глазами вашей роли',
    rolesLabel: 'Выберите роль для просмотра',
    note: 'Это публичное объяснение пользы. Выбор роли здесь не открывает данные и не назначает права — реальные полномочия определяются системой после регистрации и проверки организации.',
    preview: 'Вымышленный пример Сделки',
    deal: 'Подсолнечник · 1 200 т',
    status: 'Шаг 5 · Приёмка и качество',
    stageLabel: '7 шагов Сделки', stages: ['Товар и условия', 'Торги и контрагент', 'Сделка и договор', 'Логистика и поставка', 'Приёмка и качество', 'Документы и готовность расчёта', 'Расчёт и закрытие'],
    route: 'Поставка', routeValue: 'Рейс завершён · прибытие подтверждено',
    quality: 'Качество', qualityValue: 'Протокол получен · проверяется по условиям',
    documents: 'Документы', documentsValue: 'Комплект собирается по Сделке',
    reserve: 'Расчёт', reserveValue: 'Готовность зависит от подтверждённых оснований',
    risk: 'Что важно этой роли', owner: 'Ответственный', next: 'Следующее действие', evidence: 'Основание', money: 'Результат для денег',
  },
  en: {
    label: 'The Deal from your role', rolesLabel: 'Choose a role to preview',
    note: 'This is a public value explanation. Choosing a role here does not expose data or grant authority; actual permissions are assigned by the system after registration and organisation verification.',
    preview: 'Fictional Deal example', deal: 'Sunflower · 1,200 t', status: 'Step 5 · Acceptance and quality',
    stageLabel: '7 Deal steps', stages: ['Product and terms', 'Bidding and counterparty', 'Deal and contract', 'Logistics and delivery', 'Acceptance and quality', 'Documents and settlement readiness', 'Settlement and closure'],
    route: 'Delivery', routeValue: 'Trip complete · arrival confirmed', quality: 'Quality', qualityValue: 'Protocol received · being checked against terms',
    documents: 'Documents', documentsValue: 'Deal document set is being assembled', reserve: 'Settlement', reserveValue: 'Readiness depends on verified evidence',
    risk: 'What matters to this role', owner: 'Owner', next: 'Next action', evidence: 'Evidence', money: 'Money outcome',
  },
  zh: {
    label: '从你的角色查看交易', rolesLabel: '选择角色查看',
    note: '这是公开价值说明。此处选择角色不会开放数据或授予权限；真实权限在注册并完成机构核验后由系统确定。',
    preview: '虚构交易示例', deal: '葵花籽 · 1,200 吨', status: '第 5 步 · 验收与质量',
    stageLabel: '交易七步', stages: ['商品与条件', '竞价与交易方', '交易与合同', '物流与交付', '验收与质量', '文件与结算准备', '结算与关闭'],
    route: '交付', routeValue: '运输完成 · 到达已确认', quality: '质量', qualityValue: '报告已收到 · 正按条件核对',
    documents: '文件', documentsValue: '正在按交易整理文件', reserve: '结算', reserveValue: '就绪状态取决于已确认依据',
    risk: '该角色关注什么', owner: '责任方', next: '下一步', evidence: '依据', money: '资金结果',
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
            <div key={stage} role='listitem' className={index < 4 ? styles.done : index === 4 ? styles.activeStage : undefined}>
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