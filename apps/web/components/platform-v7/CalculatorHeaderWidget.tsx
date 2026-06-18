'use client';

import { Calculator, Delete, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

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

function CalculatorPanel({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [fresh, setFresh] = useState(true);

  const shownOperator = useMemo(() => operator ?? '—', [operator]);

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

  const buttons = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', ',', '=', '+'];

  return (
    <div className='p7-calc-panel' role='dialog' aria-label='Калькулятор'>
      <div className='p7-calc-head'>
        <strong>Калькулятор</strong>
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
    </div>
  );
}

export function CalculatorHeaderWidget() {
  const [open, setOpen] = useState(false);
  const mount = useHeaderActionsMount();

  const widget = (
    <div className='p7-calc-widget'>
      <style dangerouslySetInnerHTML={{ __html: `
        .p7-calc-widget{position:relative;display:inline-flex!important;flex:0 0 auto!important}
        .p7-calc-panel{position:absolute;right:0;top:50px;width:min(320px,calc(100vw - 20px));padding:12px;border:1px solid var(--pc-border);border-radius:20px;background:var(--pc-bg-card);box-shadow:var(--pc-shadow-lg);z-index:520;display:grid;gap:10px;color:var(--pc-text-primary)}
        .p7-calc-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.p7-calc-head strong{font-size:14px;font-weight:950}.p7-calc-head button{width:32px;height:32px;border-radius:12px;border:1px solid var(--pc-border);background:var(--pc-bg-elevated);color:var(--pc-text-secondary);display:inline-flex;align-items:center;justify-content:center}
        .p7-calc-display{min-height:76px;border:1px solid var(--pc-border);border-radius:17px;background:var(--pc-bg-elevated);padding:10px 12px;display:grid;align-content:center;justify-items:end;gap:4px}.p7-calc-display span{font-size:11px;color:var(--pc-text-muted);font-weight:800}.p7-calc-display strong{font-size:30px;line-height:1;font-weight:950;letter-spacing:-.04em;max-width:100%;overflow:hidden;text-overflow:ellipsis}
        .p7-calc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.p7-calc-grid button{height:42px;border-radius:14px;border:1px solid var(--pc-border);background:var(--pc-bg-elevated);color:var(--pc-text-primary);font-size:16px;font-weight:900;display:inline-flex;align-items:center;justify-content:center}.p7-calc-grid button:hover{border-color:var(--pc-border-light)}.p7-calc-grid .p7-calc-soft{color:var(--pc-text-secondary)}.p7-calc-grid .p7-calc-op{color:var(--pc-accent-strong);background:var(--pc-accent-bg);border-color:var(--pc-accent-border)}.p7-calc-grid .p7-calc-equals{color:white;background:var(--pc-accent);border-color:var(--pc-accent)}
        @media(max-width:767px){.p7-calc-widget .pc-v4-iconbtn{width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;border-radius:13px!important}.p7-calc-panel{position:fixed;top:calc(env(safe-area-inset-top) + 58px);right:10px;left:10px;width:auto}}
      ` }} />
      <button type='button' className='pc-v4-iconbtn' aria-label='Открыть калькулятор' title='Калькулятор' onClick={() => setOpen((value) => !value)}>
        <Calculator size={18} strokeWidth={2.35} />
      </button>
      {open ? <CalculatorPanel onClose={() => setOpen(false)} /> : null}
    </div>
  );

  return mount ? createPortal(widget, mount) : null;
}
