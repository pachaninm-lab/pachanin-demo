'use client';

import { Calculator, Delete, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

function useHeaderActionsMount() {
  const [mount, setMount] = useState<Element | null>(null);

  useEffect(() => {
    const sync = () => setMount(document.querySelector('.pc-v4-actions'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return mount;
}

type Operator = '+' | '-' | '×' | '÷' | null;

type RoleField = {
  key: string;
  label: string;
  suffix: string;
  defaultValue: string;
};

type RoleResult = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'strong' | 'muted';
};

type RoleCalculatorPreset = {
  title: string;
  subtitle: string;
  formula: string;
  fields: RoleField[];
  compute: (values: Record<string, number>) => RoleResult[];
};

function applyOperation(left: number, right: number, operator: Operator) {
  if (operator === '+') return left + right;
  if (operator === '-') return left - right;
  if (operator === '×') return left * right;
  if (operator === '÷') return right === 0 ? Number.NaN : left / right;
  return right;
}

function formatValue(value: number) {
  if (!Number.isFinite(value)) return 'Ошибка';
  const rounded = Math.round(value * 100000000) / 100000000;
  return String(rounded).replace('.', ',');
}

function readNumber(value: string | number | undefined) {
  const normalized = String(value ?? '0').replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value)) + ' ₽';
}

function formatPlain(value: number, suffix = '') {
  if (!Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

const ROLE_LABELS: Record<PlatformRole, string> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логист',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  bank: 'Банк',
  arbitrator: 'Арбитр',
  compliance: 'Комплаенс',
  executive: 'Руководитель',
};

const ROLE_CALCULATORS: Partial<Record<PlatformRole, RoleCalculatorPreset>> = {
  operator: {
    title: 'Операционный маржинальный расчёт',
    subtitle: 'Проверяет сделку по цене, себестоимости, удержаниям и рейсам.',
    formula: 'Маржа = цена × тоннаж − себестоимость × тоннаж − удержания − рейсы × стоимость рейса',
    fields: [
      { key: 'price', label: 'Цена за тонну', suffix: '₽/т', defaultValue: '14500' },
      { key: 'cost', label: 'Себестоимость за тонну', suffix: '₽/т', defaultValue: '13200' },
      { key: 'tons', label: 'Тоннаж', suffix: 'т', defaultValue: '500' },
      { key: 'deductions', label: 'Удержания', suffix: '₽', defaultValue: '75000' },
      { key: 'trips', label: 'Рейсы', suffix: 'шт', defaultValue: '20' },
      { key: 'tripCost', label: 'Стоимость рейса', suffix: '₽', defaultValue: '18000' },
    ],
    compute: (v) => {
      const revenue = v.price * v.tons;
      const cost = v.cost * v.tons;
      const logisticsCost = v.trips * v.tripCost;
      const margin = revenue - cost - v.deductions - logisticsCost;
      return [
        { label: 'Выручка', value: formatMoney(revenue) },
        { label: 'Логистика', value: formatMoney(logisticsCost) },
        { label: 'Чистая маржа', value: formatMoney(margin), tone: 'strong' },
      ];
    },
  },
  buyer: {
    title: 'Итоговая стоимость закупки',
    subtitle: 'Показывает бюджет с доставкой, комиссией и допуском по массе.',
    formula: 'Бюджет = цена × тоннаж + доставка + комиссия − скидка',
    fields: [
      { key: 'price', label: 'Цена за тонну', suffix: '₽/т', defaultValue: '14600' },
      { key: 'tons', label: 'Плановый тоннаж', suffix: 'т', defaultValue: '500' },
      { key: 'delivery', label: 'Доставка', suffix: '₽', defaultValue: '360000' },
      { key: 'commission', label: 'Комиссия', suffix: '₽', defaultValue: '90000' },
      { key: 'discount', label: 'Скидка/зачёт', suffix: '₽', defaultValue: '50000' },
      { key: 'tolerance', label: 'Допуск по массе', suffix: '%', defaultValue: '2' },
    ],
    compute: (v) => {
      const goods = v.price * v.tons;
      const budget = goods + v.delivery + v.commission - v.discount;
      const maxTons = v.tons * (1 + v.tolerance / 100);
      return [
        { label: 'Товар', value: formatMoney(goods) },
        { label: 'Макс. тоннаж по допуску', value: formatPlain(maxTons, ' т') },
        { label: 'Итоговый бюджет', value: formatMoney(budget), tone: 'strong' },
      ];
    },
  },
  seller: {
    title: 'Чистая сумма продавца',
    subtitle: 'Считает деньги после логистики, лаборатории, комиссии и удержаний.',
    formula: 'К получению = цена × тоннаж − логистика − лаборатория − комиссия − удержания',
    fields: [
      { key: 'price', label: 'Цена за тонну', suffix: '₽/т', defaultValue: '14500' },
      { key: 'tons', label: 'Факт тоннажа', suffix: 'т', defaultValue: '480' },
      { key: 'logistics', label: 'Логистика', suffix: '₽', defaultValue: '340000' },
      { key: 'lab', label: 'Лаборатория', suffix: '₽', defaultValue: '45000' },
      { key: 'commission', label: 'Комиссия', suffix: '₽', defaultValue: '70000' },
      { key: 'deductions', label: 'Удержания', suffix: '₽', defaultValue: '30000' },
    ],
    compute: (v) => {
      const gross = v.price * v.tons;
      const costs = v.logistics + v.lab + v.commission + v.deductions;
      return [
        { label: 'Валовая сумма', value: formatMoney(gross) },
        { label: 'Расходы/удержания', value: formatMoney(costs) },
        { label: 'К получению', value: formatMoney(gross - costs), tone: 'strong' },
      ];
    },
  },
  logistics: {
    title: 'Стоимость перевозки',
    subtitle: 'Считает рейс по километрам, ставке, простоям и погрузке.',
    formula: 'Рейс = км × ставка + погрузка + простой × ставка простоя',
    fields: [
      { key: 'km', label: 'Маршрут', suffix: 'км', defaultValue: '420' },
      { key: 'rate', label: 'Ставка за км', suffix: '₽/км', defaultValue: '95' },
      { key: 'loading', label: 'Погрузка/разгрузка', suffix: '₽', defaultValue: '12000' },
      { key: 'idleHours', label: 'Простой', suffix: 'ч', defaultValue: '6' },
      { key: 'idleRate', label: 'Ставка простоя', suffix: '₽/ч', defaultValue: '1500' },
      { key: 'trips', label: 'Количество рейсов', suffix: 'шт', defaultValue: '12' },
    ],
    compute: (v) => {
      const trip = v.km * v.rate + v.loading + v.idleHours * v.idleRate;
      return [
        { label: 'Один рейс', value: formatMoney(trip) },
        { label: 'Все рейсы', value: formatMoney(trip * v.trips), tone: 'strong' },
        { label: 'Стоимость 1 км', value: formatMoney(trip / Math.max(v.km, 1)) },
      ];
    },
  },
  elevator: {
    title: 'Элеватор: хранение и доработка',
    subtitle: 'Считает хранение, сушку, очистку и потери массы.',
    formula: 'Итого = тонны × дни × хранение + сушка + очистка; потери = тонны × % потерь',
    fields: [
      { key: 'tons', label: 'Тоннаж', suffix: 'т', defaultValue: '500' },
      { key: 'days', label: 'Дней хранения', suffix: 'дн', defaultValue: '14' },
      { key: 'storageRate', label: 'Хранение', suffix: '₽/т/дн', defaultValue: '18' },
      { key: 'drying', label: 'Сушка', suffix: '₽', defaultValue: '90000' },
      { key: 'cleaning', label: 'Очистка', suffix: '₽', defaultValue: '55000' },
      { key: 'lossPercent', label: 'Потери массы', suffix: '%', defaultValue: '1.2' },
    ],
    compute: (v) => {
      const storage = v.tons * v.days * v.storageRate;
      const total = storage + v.drying + v.cleaning;
      const lossTons = v.tons * v.lossPercent / 100;
      return [
        { label: 'Хранение', value: formatMoney(storage) },
        { label: 'Потеря массы', value: formatPlain(lossTons, ' т') },
        { label: 'Итого услуги', value: formatMoney(total), tone: 'strong' },
      ];
    },
  },
  bank: {
    title: 'Банк: резерв и выпуск средств',
    subtitle: 'Показывает резерв, комиссию и доступный выпуск.',
    formula: 'К выпуску = сумма сделки × % выпуска − комиссия − блокировка по спору',
    fields: [
      { key: 'dealAmount', label: 'Сумма сделки', suffix: '₽', defaultValue: '7250000' },
      { key: 'releasePercent', label: 'Процент выпуска', suffix: '%', defaultValue: '80' },
      { key: 'feePercent', label: 'Комиссия банка', suffix: '%', defaultValue: '0.7' },
      { key: 'disputeHold', label: 'Блокировка по спору', suffix: '₽', defaultValue: '250000' },
      { key: 'reservePercent', label: 'Резерв', suffix: '%', defaultValue: '20' },
      { key: 'alreadyReleased', label: 'Уже выпущено', suffix: '₽', defaultValue: '0' },
    ],
    compute: (v) => {
      const releaseBase = v.dealAmount * v.releasePercent / 100;
      const fee = v.dealAmount * v.feePercent / 100;
      const reserve = v.dealAmount * v.reservePercent / 100;
      const available = releaseBase - fee - v.disputeHold - v.alreadyReleased;
      return [
        { label: 'Резерв', value: formatMoney(reserve) },
        { label: 'Комиссия', value: formatMoney(fee) },
        { label: 'Доступно к выпуску', value: formatMoney(available), tone: 'strong' },
      ];
    },
  },
  arbitrator: {
    title: 'Арбитраж: сумма спора',
    subtitle: 'Вес, качество, простой и доказательные расходы.',
    formula: 'Спор = дельта веса × цена + штраф качества + простой + доказательства',
    fields: [
      { key: 'weightDelta', label: 'Спорная масса', suffix: 'т', defaultValue: '18' },
      { key: 'price', label: 'Цена за тонну', suffix: '₽/т', defaultValue: '14500' },
      { key: 'qualityPenalty', label: 'Штраф качества', suffix: '₽', defaultValue: '120000' },
      { key: 'idle', label: 'Простой', suffix: '₽', defaultValue: '45000' },
      { key: 'evidence', label: 'Доказательства', suffix: '₽', defaultValue: '30000' },
      { key: 'settlementPercent', label: 'Вероятный компромисс', suffix: '%', defaultValue: '65' },
    ],
    compute: (v) => {
      const claim = v.weightDelta * v.price + v.qualityPenalty + v.idle + v.evidence;
      return [
        { label: 'Претензия по весу', value: formatMoney(v.weightDelta * v.price) },
        { label: 'Полная сумма спора', value: formatMoney(claim), tone: 'strong' },
        { label: 'Компромиссная сумма', value: formatMoney(claim * v.settlementPercent / 100) },
      ];
    },
  },
  executive: {
    title: 'Руководитель: портфельная экономика',
    subtitle: 'Сделки, средняя маржа, операционные расходы и конверсия.',
    formula: 'Прибыль = сделки × средняя маржа × конверсия − постоянные расходы',
    fields: [
      { key: 'deals', label: 'Сделок в месяц', suffix: 'шт', defaultValue: '24' },
      { key: 'avgMargin', label: 'Средняя маржа', suffix: '₽', defaultValue: '180000' },
      { key: 'conversion', label: 'Конверсия закрытия', suffix: '%', defaultValue: '72' },
      { key: 'fixedCosts', label: 'Постоянные расходы', suffix: '₽', defaultValue: '1450000' },
      { key: 'partnerShare', label: 'Доля партнёров', suffix: '%', defaultValue: '12' },
      { key: 'riskReserve', label: 'Резерв риска', suffix: '₽', defaultValue: '300000' },
    ],
    compute: (v) => {
      const gross = v.deals * v.avgMargin * v.conversion / 100;
      const partner = gross * v.partnerShare / 100;
      const net = gross - partner - v.fixedCosts - v.riskReserve;
      return [
        { label: 'Валовая маржа', value: formatMoney(gross) },
        { label: 'Партнёрская доля', value: formatMoney(partner) },
        { label: 'Операционная прибыль', value: formatMoney(net), tone: 'strong' },
      ];
    },
  },
};

function CalculatorPanel({ role, onClose }: { role: PlatformRole; onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [fresh, setFresh] = useState(true);
  const [roleValues, setRoleValues] = useState<Record<string, string>>({});

  const shownOperator = useMemo(() => operator ?? '—', [operator]);
  const rolePreset = ROLE_CALCULATORS[role];

  useEffect(() => {
    if (!rolePreset) {
      setRoleValues({});
      return;
    }
    setRoleValues(Object.fromEntries(rolePreset.fields.map((field) => [field.key, field.defaultValue])));
  }, [rolePreset]);

  const numericRoleValues = useMemo(
    () => rolePreset ? Object.fromEntries(rolePreset.fields.map((field) => [field.key, readNumber(roleValues[field.key])])) : {},
    [rolePreset, roleValues]
  );
  const roleResults = useMemo(() => rolePreset ? rolePreset.compute(numericRoleValues) : [], [numericRoleValues, rolePreset]);

  const inputDigit = (digit: string) => {
    setDisplay((value) => {
      if (fresh || value === '0' || value === 'Ошибка') return digit;
      return value.length >= 14 ? value : value + digit;
    });
    setFresh(false);
  };

  const inputDecimal = () => {
    setDisplay((value) => {
      if (fresh || value === 'Ошибка') return '0,';
      return value.includes(',') ? value : value + ',';
    });
    setFresh(false);
  };

  const currentNumber = () => Number(display.replace(',', '.'));

  const chooseOperator = (nextOperator: Exclude<Operator, null>) => {
    const current = currentNumber();
    if (stored === null || operator === null) {
      setStored(current);
    } else if (!fresh) {
      const result = applyOperation(stored, current, operator);
      setStored(result);
      setDisplay(formatValue(result));
    }
    setOperator(nextOperator);
    setFresh(true);
  };

  const equals = () => {
    if (stored === null || operator === null) return;
    const result = applyOperation(stored, currentNumber(), operator);
    setDisplay(formatValue(result));
    setStored(null);
    setOperator(null);
    setFresh(true);
  };

  const clear = () => {
    setDisplay('0');
    setStored(null);
    setOperator(null);
    setFresh(true);
  };

  const backspace = () => {
    setDisplay((value) => {
      if (fresh || value === 'Ошибка' || value.length <= 1) return '0';
      return value.slice(0, -1);
    });
  };

  const resetRoleValues = () => {
    if (!rolePreset) return;
    setRoleValues(Object.fromEntries(rolePreset.fields.map((field) => [field.key, field.defaultValue])));
  };

  const buttons = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', ',', '=', '+'];

  return (
    <div className='p7-calc-panel' role='dialog' aria-label='Калькулятор'>
      <div className='p7-calc-head'>
        <div>
          <strong>Калькулятор</strong>
          <span>{rolePreset ? `${ROLE_LABELS[role]} · обычный + ролевой расчёт` : `${ROLE_LABELS[role]} · обычный расчёт`}</span>
        </div>
        <button type='button' onClick={onClose} aria-label='Закрыть калькулятор'><X size={15} /></button>
      </div>
      <div className='p7-calc-display'>
        <span>{stored !== null ? `${formatValue(stored)} ${shownOperator}` : 'Обычный расчёт'}</span>
        <strong>{display}</strong>
      </div>
      <div className='p7-calc-grid'>
        <button type='button' className='p7-calc-soft' onClick={clear}>C</button>
        <button type='button' className='p7-calc-soft' onClick={backspace}><Delete size={15} /></button>
        <button type='button' className='p7-calc-soft' onClick={() => chooseOperator('÷')}>÷</button>
        <button type='button' className='p7-calc-soft' onClick={() => chooseOperator('×')}>×</button>
        {buttons.map((button) => (
          <button
            type='button'
            key={button}
            className={button === '=' ? 'p7-calc-equals' : ['+', '-', '×', '÷'].includes(button) ? 'p7-calc-op' : undefined}
            onClick={() => {
              if (button === ',') inputDecimal();
              else if (button === '=') equals();
              else if (['+', '-', '×', '÷'].includes(button)) chooseOperator(button as Exclude<Operator, null>);
              else inputDigit(button);
            }}
          >
            {button}
          </button>
        ))}
      </div>
      {rolePreset ? (
        <section className='p7-role-calc' aria-label={`Ролевой расчёт: ${ROLE_LABELS[role]}`}>
          <div className='p7-role-calc-title'>
            <div>
              <strong>{rolePreset.title}</strong>
              <span>{rolePreset.subtitle}</span>
            </div>
            <button type='button' onClick={resetRoleValues}>Сброс</button>
          </div>
          <div className='p7-role-calc-fields'>
            {rolePreset.fields.map((field) => (
              <label key={field.key}>
                <span>{field.label}</span>
                <div>
                  <input
                    inputMode='decimal'
                    value={roleValues[field.key] ?? ''}
                    onChange={(event) => setRoleValues((values) => ({ ...values, [field.key]: event.target.value }))}
                    aria-label={field.label}
                  />
                  <em>{field.suffix}</em>
                </div>
              </label>
            ))}
          </div>
          <div className='p7-role-calc-results'>
            {roleResults.map((result) => (
              <div key={result.label} className={result.tone === 'strong' ? 'p7-role-calc-result p7-role-calc-result-strong' : 'p7-role-calc-result'}>
                <span>{result.label}</span>
                <strong>{result.value}</strong>
                {result.hint ? <small>{result.hint}</small> : null}
              </div>
            ))}
          </div>
          <p>{rolePreset.formula}</p>
        </section>
      ) : null}
    </div>
  );
}

export function CalculatorHeaderWidget() {
  const [open, setOpen] = useState(false);
  const mount = useHeaderActionsMount();
  const role = usePlatformV7RStore((state) => state.role);

  const widget = (
    <div className='p7-calc-widget'>
      <style dangerouslySetInnerHTML={{ __html: `
        .p7-calc-widget{position:relative;display:inline-flex!important;flex:0 0 auto!important}
        .p7-calc-panel{position:absolute;right:0;top:50px;width:min(440px,calc(100vw - 20px));max-height:min(720px,calc(100vh - 84px));overflow:auto;padding:12px;border:1px solid var(--pc-border);border-radius:20px;background:var(--pc-bg-card);box-shadow:var(--pc-shadow-lg);z-index:520;display:grid;gap:10px;color:var(--pc-text-primary)}
        .p7-calc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.p7-calc-head div{display:grid;gap:2px}.p7-calc-head strong{font-size:14px;font-weight:950}.p7-calc-head span{font-size:11px;color:var(--pc-text-muted);font-weight:800}.p7-calc-head button{width:32px;height:32px;border-radius:12px;border:1px solid var(--pc-border);background:var(--pc-bg-elevated);color:var(--pc-text-secondary);display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}
        .p7-calc-display{min-height:76px;border:1px solid var(--pc-border);border-radius:17px;background:var(--pc-bg-elevated);padding:10px 12px;display:grid;align-content:center;justify-items:end;gap:4px}.p7-calc-display span{font-size:11px;color:var(--pc-text-muted);font-weight:800}.p7-calc-display strong{font-size:30px;line-height:1;font-weight:950;letter-spacing:-.04em;max-width:100%;overflow:hidden;text-overflow:ellipsis}
        .p7-calc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.p7-calc-grid button{height:42px;border-radius:14px;border:1px solid var(--pc-border);background:var(--pc-bg-elevated);color:var(--pc-text-primary);font-size:16px;font-weight:900;display:inline-flex;align-items:center;justify-content:center}.p7-calc-grid button:hover{border-color:var(--pc-border-light)}.p7-calc-grid .p7-calc-soft{color:var(--pc-text-secondary)}.p7-calc-grid .p7-calc-op{color:var(--pc-accent-strong);background:var(--pc-accent-bg);border-color:var(--pc-accent-border)}.p7-calc-grid .p7-calc-equals{color:white;background:var(--pc-accent);border-color:var(--pc-accent)}
        .p7-role-calc{border:1px solid var(--pc-border);border-radius:18px;background:var(--pc-bg-elevated);padding:10px;display:grid;gap:10px}.p7-role-calc-title{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.p7-role-calc-title div{display:grid;gap:3px}.p7-role-calc-title strong{font-size:13px;font-weight:950}.p7-role-calc-title span{font-size:11px;line-height:1.35;color:var(--pc-text-muted);font-weight:750}.p7-role-calc-title button{height:30px;padding:0 9px;border-radius:11px;border:1px solid var(--pc-border);background:var(--pc-bg-card);color:var(--pc-text-secondary);font-size:11px;font-weight:900;flex:0 0 auto}
        .p7-role-calc-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.p7-role-calc-fields label{display:grid;gap:4px}.p7-role-calc-fields label>span{font-size:10px;color:var(--pc-text-muted);font-weight:850}.p7-role-calc-fields label>div{height:36px;border:1px solid var(--pc-border);border-radius:12px;background:var(--pc-bg-card);display:flex;align-items:center;overflow:hidden}.p7-role-calc-fields input{min-width:0;width:100%;height:100%;border:0;background:transparent;color:var(--pc-text-primary);padding:0 8px;font-size:13px;font-weight:850;outline:none}.p7-role-calc-fields em{font-style:normal;color:var(--pc-text-muted);font-size:10px;font-weight:850;padding-right:8px;white-space:nowrap}
        .p7-role-calc-results{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.p7-role-calc-result{min-height:62px;border:1px solid var(--pc-border);border-radius:14px;background:var(--pc-bg-card);padding:8px;display:grid;align-content:center;gap:4px}.p7-role-calc-result span{font-size:10px;color:var(--pc-text-muted);font-weight:850}.p7-role-calc-result strong{font-size:14px;line-height:1.12;font-weight:950;color:var(--pc-text-primary);word-break:break-word}.p7-role-calc-result-strong{border-color:var(--pc-accent-border);background:var(--pc-accent-bg)}.p7-role-calc-result-strong strong{color:var(--pc-accent-strong)}.p7-role-calc p{margin:0;color:var(--pc-text-muted);font-size:10px;line-height:1.35;font-weight:750}
        @media(max-width:767px){.p7-calc-widget .pc-v4-iconbtn{width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;border-radius:13px!important}.p7-calc-panel{position:fixed;top:calc(env(safe-area-inset-top) + 58px);right:10px;left:10px;width:auto;max-height:calc(100vh - env(safe-area-inset-top) - 74px)}.p7-role-calc-fields{grid-template-columns:1fr}.p7-role-calc-results{grid-template-columns:1fr}}
      ` }} />
      <button type='button' className='pc-v4-iconbtn' aria-label='Открыть калькулятор' title='Калькулятор' onClick={() => setOpen((value) => !value)}>
        <Calculator size={18} strokeWidth={2.35} />
      </button>
      {open ? <CalculatorPanel role={role} onClose={() => setOpen(false)} /> : null}
    </div>
  );

  return mount ? createPortal(widget, mount) : null;
}
