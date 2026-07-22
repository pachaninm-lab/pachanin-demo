'use client';

import { useMemo, useState } from 'react';
import { CircleDollarSign, FileCheck2, ShieldAlert, UserRoundCheck } from 'lucide-react';
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

const scenarios: Record<Locale, Record<RoleKey, RoleScenario>> = {
  ru: {
    seller: { label: 'Продавец', risk: 'Оплата не может быть выпущена из-за расхождения качества и неподписанного акта.', owner: 'Покупатель и лаборатория', next: 'Проверить проект акта и запросить подтверждение покупателя.', evidence: 'Протокол лаборатории, спецификация, акт расхождений.', money: 'Средства зарезервированы; окончательный release заблокирован.' },
    buyer: { label: 'Покупатель', risk: 'Фактическая влажность выше договорного допуска на 0,8 п.п.', owner: 'Лаборатория', next: 'Выбрать договорное правило перерасчёта и подписать акт.', evidence: 'Проба, протокол лаборатории, версия спецификации.', money: 'Резерв сохранён до подтверждения нового основания расчёта.' },
    logistics: { label: 'Логистика', risk: 'Рейс завершён физически, но приёмка не закрыта документально.', owner: 'Хранение и покупатель', next: 'Передать подтверждение рейса и дождаться закрытия приёмки.', evidence: 'ЭПД, отметки прибытия, весовые данные.', money: 'Перевозка отделена от окончательного расчёта за товар.' },
    storage: { label: 'Хранение', risk: 'Партия принята условно до решения по показателю качества.', owner: 'Лаборатория и покупатель', next: 'Зафиксировать размещение партии и режим условного хранения.', evidence: 'Акт приёмки, вес, место хранения, статус партии.', money: 'Основание передачи товара есть, основание финального расчёта — нет.' },
    laboratory: { label: 'Лаборатория', risk: 'Результат вышел за допуск и требует подтверждённой привязки к пробе.', owner: 'Лаборатория', next: 'Подтвердить протокол, методику и идентификатор пробы.', evidence: 'Цепочка проба → измерение → протокол → партия.', money: 'Результат влияет на формулу цены, но сам не выпускает деньги.' },
    bank: { label: 'Банк', risk: 'Событие release не наступило: отсутствует подписанное основание перерасчёта.', owner: 'Покупатель и продавец', next: 'Сохранить резерв и ожидать подтверждённое событие Сделки.', evidence: 'Статусы приёмки, качества, подписи и версии расчёта.', money: 'Резервирование активно; release запрещён политикой сделки.' },
  },
  en: {
    seller: { label: 'Seller', risk: 'Payment cannot be released because quality differs from tolerance and the discrepancy act is unsigned.', owner: 'Buyer and laboratory', next: 'Review the prepared act and request buyer confirmation.', evidence: 'Laboratory protocol, specification and discrepancy act.', money: 'Funds remain reserved; final release is blocked.' },
    buyer: { label: 'Buyer', risk: 'Measured moisture is 0.8 percentage points above contractual tolerance.', owner: 'Laboratory', next: 'Select the contractual recalculation rule and sign the act.', evidence: 'Sample, laboratory protocol and specification version.', money: 'The reserve remains until a revised settlement basis is confirmed.' },
    logistics: { label: 'Logistics', risk: 'The trip is physically complete, but acceptance is not closed in documents.', owner: 'Storage and buyer', next: 'Submit trip evidence and wait for acceptance closure.', evidence: 'Electronic transport document, arrival marks and weight data.', money: 'Freight execution is separated from final product settlement.' },
    storage: { label: 'Storage', risk: 'The lot is accepted conditionally pending a quality decision.', owner: 'Laboratory and buyer', next: 'Record placement and the conditional storage regime.', evidence: 'Acceptance act, weight, storage location and lot status.', money: 'Transfer evidence exists; final settlement evidence does not.' },
    laboratory: { label: 'Laboratory', risk: 'The result is outside tolerance and must be traceably linked to the sample.', owner: 'Laboratory', next: 'Confirm the protocol, method and sample identifier.', evidence: 'Sample → measurement → protocol → lot trace.', money: 'The result affects pricing but cannot release funds itself.' },
    bank: { label: 'Bank', risk: 'The release event has not occurred because the recalculation basis is unsigned.', owner: 'Buyer and seller', next: 'Keep funds reserved and wait for a confirmed Deal event.', evidence: 'Acceptance, quality, signature and calculation-version statuses.', money: 'Reservation is active; release is prohibited by Deal policy.' },
  },
  zh: {
    seller: { label: '卖方', risk: '因质量偏差且差异单未签署，款项不能释放。', owner: '买方与实验室', next: '检查已准备的差异单并请求买方确认。', evidence: '实验室报告、规格版本和差异单。', money: '资金保持预留，最终放款被阻止。' },
    buyer: { label: '买方', risk: '实测水分比合同容差高 0.8 个百分点。', owner: '实验室', next: '选择合同重算规则并签署差异单。', evidence: '样品、实验室报告和规格版本。', money: '在新结算依据确认前保持资金预留。' },
    logistics: { label: '物流', risk: '运输已实际完成，但验收文件尚未关闭。', owner: '仓储与买方', next: '提交运输证明并等待验收关闭。', evidence: '电子运输文件、到达记录和称重数据。', money: '运费执行与商品最终结算分开处理。' },
    storage: { label: '仓储', risk: '该批次在质量决定前处于有条件接收状态。', owner: '实验室与买方', next: '记录存放位置和有条件仓储制度。', evidence: '验收单、重量、存放位置和批次状态。', money: '已有交接依据，但尚无最终结算依据。' },
    laboratory: { label: '实验室', risk: '结果超出容差，必须可追溯地关联到样品。', owner: '实验室', next: '确认报告、检测方法和样品标识。', evidence: '样品 → 测量 → 报告 → 批次链路。', money: '结果影响定价，但不能自行释放资金。' },
    bank: { label: '银行', risk: '因重算依据未签署，放款事件尚未发生。', owner: '买方与卖方', next: '保持资金预留并等待已确认的交易事件。', evidence: '验收、质量、签名和计算版本状态。', money: '预留有效；交易策略禁止放款。' },
  },
};

const ui = {
  ru: { label: 'Посмотреть глазами участника', risk: 'Риск', owner: 'Ответственный', next: 'Следующее действие', evidence: 'Доказательства', money: 'Деньги', note: 'Публичная симуляция. Роль не предоставляет доступ и не изменяет RBAC.' },
  en: { label: 'View by participant perspective', risk: 'Risk', owner: 'Owner', next: 'Next action', evidence: 'Evidence', money: 'Money', note: 'Public simulation. Selecting a role grants no access and does not change RBAC.' },
  zh: { label: '按参与方视角查看', risk: '风险', owner: '责任方', next: '下一步', evidence: '证据', money: '资金', note: '公开模拟。选择角色不会授予访问权限，也不会改变 RBAC。' },
} satisfies Record<Locale, Record<string, string>>;

export function PublicDealRoleScenario({ locale }: { locale: string }) {
  const normalized: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const [role, setRole] = useState<RoleKey>('buyer');
  const copy = ui[normalized];
  const selected = useMemo(() => scenarios[normalized][role], [normalized, role]);

  return <div className={styles.root}>
    <div className={styles.heading}><strong>{copy.label}</strong><span>{copy.note}</span></div>
    <div className={styles.tabs} role='tablist' aria-label={copy.label}>
      {(Object.keys(scenarios[normalized]) as RoleKey[]).map((key) => <button key={key} type='button' role='tab' aria-selected={role === key} className={role === key ? styles.active : undefined} onClick={() => setRole(key)}>{scenarios[normalized][key].label}</button>)}
    </div>
    <div className={styles.panel} role='tabpanel' aria-live='polite'>
      <article><ShieldAlert aria-hidden='true'/><div><span>{copy.risk}</span><strong>{selected.risk}</strong></div></article>
      <article><UserRoundCheck aria-hidden='true'/><div><span>{copy.owner}</span><strong>{selected.owner}</strong></div></article>
      <article><FileCheck2 aria-hidden='true'/><div><span>{copy.next}</span><strong>{selected.next}</strong><small>{copy.evidence}: {selected.evidence}</small></div></article>
      <article><CircleDollarSign aria-hidden='true'/><div><span>{copy.money}</span><strong>{selected.money}</strong></div></article>
    </div>
  </div>;
}
