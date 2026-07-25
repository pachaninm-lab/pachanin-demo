'use client';

import { useMemo, useState } from 'react';
import {
  CircleDollarSign,
  FileCheck2,
  FlaskConical,
  MapPinned,
  ShieldAlert,
  UserRoundCheck,
} from 'lucide-react';
import styles from './PublicDealRoleScenario.module.css';

type Locale = 'ru' | 'en' | 'zh';
type RoleKey = 'seller' | 'buyer' | 'logistics' | 'storage' | 'laboratory' | 'bank';

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
    storage: { label: 'Хранение', risk: 'Партия принята условно до решения по показателю качества.', owner: 'Лаборатория и покупатель', next: 'Зафиксировать размещение партии и режим условного хранения.', evidence: 'Акт приёмки, вес, место хранения и статус партии.', money: 'Основание передачи товара есть, основания окончательного расчёта пока нет.' },
    laboratory: { label: 'Лаборатория', risk: 'Результат вышел за допуск и должен быть связан с конкретной пробой.', owner: 'Лаборатория', next: 'Подтвердить протокол, методику и идентификатор пробы.', evidence: 'Проба → измерение → протокол → партия.', money: 'Результат влияет на формулу цены, но сам по себе не запускает выплату.' },
    bank: { label: 'Банк', risk: 'Основание для выплаты ещё не подтверждено: правило перерасчёта не подписано.', owner: 'Покупатель и продавец', next: 'Сохранить резерв и ожидать подтверждённое событие Сделки.', evidence: 'Статусы приёмки, качества, подписей и версии расчёта.', money: 'Резервирование действует; выплата остановлена правилами Сделки.' },
  },
  en: {
    seller: { label: 'Seller', risk: 'Payment is paused because quality differs from the agreed terms and the discrepancy act is unsigned.', owner: 'Buyer and laboratory', next: 'Review the prepared act and request buyer confirmation.', evidence: 'Laboratory protocol, specification and discrepancy act.', money: 'Funds remain reserved; the final payout is paused.' },
    buyer: { label: 'Buyer', risk: 'Measured moisture is 0.8 percentage points above contractual tolerance.', owner: 'Laboratory', next: 'Select the contractual recalculation rule and sign the act.', evidence: 'Sample, laboratory protocol and specification version.', money: 'The reserve remains until a revised settlement basis is confirmed.' },
    logistics: { label: 'Logistics', risk: 'The trip is physically complete, but acceptance is not closed in the documents.', owner: 'Storage and buyer', next: 'Submit trip evidence and wait for acceptance closure.', evidence: 'Electronic transport document, arrival marks and weight data.', money: 'Freight settlement is separated from final product settlement.' },
    storage: { label: 'Storage', risk: 'The lot is accepted conditionally pending a quality decision.', owner: 'Laboratory and buyer', next: 'Record placement and the conditional storage regime.', evidence: 'Acceptance act, weight, storage location and lot status.', money: 'Transfer evidence exists; the final settlement basis does not yet.' },
    laboratory: { label: 'Laboratory', risk: 'The result is outside tolerance and must be traceably linked to the sample.', owner: 'Laboratory', next: 'Confirm the protocol, method and sample identifier.', evidence: 'Sample → measurement → protocol → lot.', money: 'The result affects pricing but does not trigger a payout by itself.' },
    bank: { label: 'Bank', risk: 'The payout basis is not yet confirmed because the recalculation rule is unsigned.', owner: 'Buyer and seller', next: 'Keep funds reserved and wait for a confirmed Deal event.', evidence: 'Acceptance, quality, signature and calculation-version statuses.', money: 'The reservation remains active; Deal rules keep the payout paused.' },
  },
  zh: {
    seller: { label: '卖方', risk: '因质量与约定不符且差异单未签署，付款已暂停。', owner: '买方与实验室', next: '检查已准备的差异单并请求买方确认。', evidence: '实验室报告、规格版本和差异单。', money: '资金保持预留，最终付款已暂停。' },
    buyer: { label: '买方', risk: '实测水分比合同容差高 0.8 个百分点。', owner: '实验室', next: '选择合同重算规则并签署差异单。', evidence: '样品、实验室报告和规格版本。', money: '在新结算依据确认前保持资金预留。' },
    logistics: { label: '物流', risk: '运输已实际完成，但验收文件尚未关闭。', owner: '仓储与买方', next: '提交运输证明并等待验收关闭。', evidence: '电子运输文件、到达记录和称重数据。', money: '运费结算与商品最终结算分开处理。' },
    storage: { label: '仓储', risk: '该批次在质量决定前处于有条件接收状态。', owner: '实验室与买方', next: '记录存放位置和有条件仓储制度。', evidence: '验收单、重量、存放位置和批次状态。', money: '已有交接依据，但最终结算依据尚未形成。' },
    laboratory: { label: '实验室', risk: '结果超出容差，必须可追溯地关联到样品。', owner: '实验室', next: '确认报告、检测方法和样品标识。', evidence: '样品 → 测量 → 报告 → 批次。', money: '结果影响定价，但不会自行触发付款。' },
    bank: { label: '银行', risk: '重算规则尚未签署，因此付款依据尚未确认。', owner: '买方与卖方', next: '保持资金预留并等待已确认的交易事件。', evidence: '验收、质量、签名和计算版本状态。', money: '预留保持有效；交易规则使付款继续暂停。' },
  },
};

const ui: Record<Locale, UiCopy> = {
  ru: {
    label: 'Сделка в работе',
    note: 'Ролевое представление одного сценария. Переключение не открывает данные и не меняет права.',
    preview: 'Пример интерфейса · данные сценария',
    deal: 'Партия пшеницы · 420 т',
    status: 'Отклонение качества',
    stageLabel: 'Этапы исполнения сценария',
    stages: ['Рейс', 'Прибытие', 'Вес', 'Лаборатория', 'Расчёт'],
    route: 'Логистика',
    routeValue: 'Рейс завершён · геозона подтверждена',
    quality: 'Лаборатория',
    qualityValue: 'Влажность 13,3% · +0,8 п.п.',
    documents: 'Документы',
    documentsValue: '5 из 6 подтверждены',
    reserve: 'Деньги',
    reserveValue: 'Средства зарезервированы',
    risk: 'Причина остановки',
    owner: 'Ответственный',
    next: 'Следующее действие',
    evidence: 'Основание',
    money: 'Правило расчёта',
  },
  en: {
    label: 'Deal in execution',
    note: 'A role-based view of one scenario. Switching views grants no data access and changes no permissions.',
    preview: 'Interface example · scenario data',
    deal: 'Wheat lot · 420 t',
    status: 'Quality deviation',
    stageLabel: 'Scenario execution stages',
    stages: ['Trip', 'Arrival', 'Weight', 'Laboratory', 'Settlement'],
    route: 'Logistics',
    routeValue: 'Trip complete · geofence confirmed',
    quality: 'Laboratory',
    qualityValue: 'Moisture 13.3% · +0.8 pp',
    documents: 'Documents',
    documentsValue: '5 of 6 confirmed',
    reserve: 'Money',
    reserveValue: 'Funds reserved',
    risk: 'Reason for pause',
    owner: 'Owner',
    next: 'Next action',
    evidence: 'Evidence',
    money: 'Settlement rule',
  },
  zh: {
    label: '执行中的交易',
    note: '同一场景的角色视图。切换视角不会授予数据访问权限，也不会更改权限。',
    preview: '界面示例 · 场景数据',
    deal: '小麦批次 · 420 吨',
    status: '质量偏差',
    stageLabel: '场景执行阶段',
    stages: ['运输', '到达', '称重', '实验室', '结算'],
    route: '物流',
    routeValue: '运输完成 · 地理围栏已确认',
    quality: '实验室',
    qualityValue: '水分 13.3% · +0.8 个百分点',
    documents: '文件',
    documentsValue: '6 份中 5 份已确认',
    reserve: '资金',
    reserveValue: '资金已预留',
    risk: '暂停原因',
    owner: '责任方',
    next: '下一步',
    evidence: '依据',
    money: '结算规则',
  },
};

export function PublicDealRoleScenario({ locale }: { locale: string }) {
  const normalized: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const [role, setRole] = useState<RoleKey>('buyer');
  const copy = ui[normalized];
  const selected = useMemo(() => scenarios[normalized][role], [normalized, role]);

  return (
    <div className={styles.root}>
      <div className={styles.heading}>
        <strong>{copy.label}</strong>
        <span>{copy.note}</span>
      </div>

      <section className={styles.workspace} aria-label={copy.preview}>
        <div className={styles.workspaceHeader}>
          <div><small>{copy.preview}</small><strong>{copy.deal}</strong></div>
          <span>{copy.status}</span>
        </div>

        <div className={styles.stageRail} role='list' aria-label={copy.stageLabel}>
          {copy.stages.map((stage, index) => (
            <div key={stage} role='listitem' className={index < 3 ? styles.done : index === 3 ? styles.activeStage : undefined}>
              <i aria-hidden='true' />
              <span>{stage}</span>
            </div>
          ))}
        </div>

        <div className={styles.metrics}>
          <article><MapPinned aria-hidden='true' /><div><span>{copy.route}</span><strong>{copy.routeValue}</strong></div></article>
          <article><FlaskConical aria-hidden='true' /><div><span>{copy.quality}</span><strong>{copy.qualityValue}</strong></div></article>
          <article><FileCheck2 aria-hidden='true' /><div><span>{copy.documents}</span><strong>{copy.documentsValue}</strong></div></article>
          <article><CircleDollarSign aria-hidden='true' /><div><span>{copy.reserve}</span><strong>{copy.reserveValue}</strong></div></article>
        </div>

        <div className={styles.tabs} role='tablist' aria-label={copy.label}>
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
