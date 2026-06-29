'use client';

import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FlaskConical,
  PlayCircle,
  Scale,
  ShieldCheck,
  Truck,
  X,
  type LucideIcon,
} from 'lucide-react';

type TourStep = {
  title: string;
  text: string;
  signal: string;
  checkpoints: string[];
  Icon: LucideIcon;
};

const tourSteps: TourStep[] = [
  {
    title: 'Цена согласована. Теперь начинается главное',
    text: 'После цены сделка быстро распадается на детали: партия, объём, базис, допуски, сроки, ответственные и следующий шаг. Тур показывает, как этот хаос собирается в один маршрут исполнения.',
    signal: 'Главный вопрос: не сколько стоит зерно, а кто, когда и на каком основании доведёт сделку до расчёта.',
    checkpoints: ['Партия и условия сделки', 'Следующее действие и ответственный'],
    Icon: ClipboardCheck,
  },
  {
    title: 'Рейс: груз движется, сделка не теряется',
    text: 'Маршрут, машина, водитель, точка погрузки, контрольные отметки и время доставки привязываются к конкретной партии. У задержки появляется причина, а у процесса — владелец действия.',
    signal: 'Стороны видят не переписку в телефоне, а состояние рейса и место возможного разрыва.',
    checkpoints: ['Маршрут, машина, водитель', 'Задержка, причина, следующий шаг'],
    Icon: Truck,
  },
  {
    title: 'Приёмка: момент истины на весах',
    text: 'Вес, влажность, сорность, класс, расхождение по объёму и качество фиксируются как события сделки. Это уже не устное “не сошлось”, а проверяемая точка, от которой зависит расчёт.',
    signal: 'Чем раньше виден разрыв по качеству или весу, тем меньше спорность и ручные потери.',
    checkpoints: ['Вес и расхождения', 'Качество и источник данных'],
    Icon: FlaskConical,
  },
  {
    title: 'Документы: сделка проходит контроль',
    text: 'Договор, СДИЗ, ЭДО, транспортные и приёмочные документы собираются в карту готовности. Если чего-то не хватает, видно, что именно остановлено и кто должен закрыть разрыв.',
    signal: 'Документы перестают быть “потом пришлём” — они становятся условием движения сделки.',
    checkpoints: ['Комплект документов', 'Статус, источник, ответственный'],
    Icon: FileCheck2,
  },
  {
    title: 'Расчёт следует за подтверждёнными событиями',
    text: 'Денежный контур опирается на выполненные этапы: поставка, приёмка, документы, отсутствие критичного спора и банковое основание. Покупатель понимает, за что платит; продавец — что ещё мешает расчёту.',
    signal: 'Здесь важна не красивая кнопка, а доказуемое основание для следующего финансового шага.',
    checkpoints: ['Готовность к расчёту', 'Основание, удержание, причина остановки'],
    Icon: Banknote,
  },
  {
    title: 'Спор: доказательства уже собраны',
    text: 'Если расходятся вес, качество, сроки или документы, спор начинается не с пустого листа. В деле уже есть события, фото, GPS, время, документы, действия сторон и логика решения.',
    signal: 'Арбитраж получает кейс, а стороны — понятный путь: что признано, что оспаривается и что закрывает вопрос.',
    checkpoints: ['Evidence pack по сделке', 'Решение, основание, следующий шаг'],
    Icon: Scale,
  },
];

const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function PublicEntryInteractiveTour() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isPublicEntry = pathname === '/platform-v7' || pathname === '/platform-v7/';

  const activeStep = tourSteps[activeIndex];
  const ActiveIcon = activeStep.Icon;
  const progressText = useMemo(() => `Шаг ${activeIndex + 1} из ${tourSteps.length}`, [activeIndex]);

  const closeTour = useCallback(() => setOpen(false), []);

  const goNext = useCallback(() => {
    setActiveIndex((current) => Math.min(current + 1, tourSteps.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setActiveIndex((current) => Math.max(current - 1, 0));
  }, []);

  const goToRoles = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => document.getElementById('roles')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        previousActiveElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const trapFocus = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)).filter((node) => !node.hasAttribute('disabled'));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  if (!isPublicEntry) return null;

  return (
    <>
      <button
        type='button'
        className='p7-public-tour-trigger'
        aria-haspopup='dialog'
        aria-expanded={open}
        onClick={() => {
          setActiveIndex(0);
          setOpen(true);
        }}
      >
        <PlayCircle size={19} strokeWidth={2.3} />
        <span>Пройти сделку за 90 секунд</span>
      </button>

      {open ? (
        <div className='p7-public-tour-layer' role='presentation'>
          <div
            ref={dialogRef}
            className='p7-public-tour-dialog'
            role='dialog'
            aria-modal='true'
            aria-labelledby='p7-public-tour-title'
            aria-describedby='p7-public-tour-description'
            onKeyDown={trapFocus}
            tabIndex={-1}
          >
            <div className='p7-public-tour-topline'>
              <span className='p7-public-tour-kicker'><ShieldCheck size={16} /> Маршрут сделки</span>
              <span className='p7-public-tour-count'>{progressText}</span>
              <button type='button' className='p7-public-tour-close' aria-label='Закрыть тур' onClick={closeTour}>
                <X size={18} />
              </button>
            </div>

            <div className='p7-public-tour-body'>
              <p className='p7-public-tour-lead'>Шесть точек, где зерновая сделка обычно теряет время, деньги и доказательства.</p>

              <div className='p7-public-tour-stage' aria-label='Этапы тура'>
                {tourSteps.map((step, index) => {
                  const StepIcon = step.Icon;
                  const done = index < activeIndex;
                  const active = index === activeIndex;
                  return (
                    <button
                      key={step.title}
                      type='button'
                      className={`p7-public-tour-node ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                      onClick={() => setActiveIndex(index)}
                      aria-label={`Шаг тура: ${step.title}`}
                      aria-current={active ? 'step' : undefined}
                    >
                      {done ? <CheckCircle2 size={17} /> : <StepIcon size={17} />}
                    </button>
                  );
                })}
              </div>

              <section className='p7-public-tour-card'>
                <div className='p7-public-tour-icon'><ActiveIcon size={31} strokeWidth={2.2} /></div>
                <div>
                  <h2 id='p7-public-tour-title'>{activeStep.title}</h2>
                  <p id='p7-public-tour-description'>{activeStep.text}</p>
                  <ul className='p7-public-tour-list' aria-label='Что видно на этом этапе'>
                    {activeStep.checkpoints.map((checkpoint) => (
                      <li key={checkpoint}>{checkpoint}</li>
                    ))}
                  </ul>
                  <strong>{activeStep.signal}</strong>
                </div>
              </section>

              <div className='p7-public-tour-mini' aria-label='Суть платформы'>
                <span><Building2 size={16} /> Сделка</span>
                <span><Truck size={16} /> Рейс</span>
                <span><FileCheck2 size={16} /> Основание</span>
                <span><Scale size={16} /> Решение</span>
              </div>
            </div>

            <div className='p7-public-tour-actions'>
              <button type='button' className='p7-public-tour-secondary' onClick={goBack} disabled={activeIndex === 0}>
                <ChevronLeft size={17} /> Назад
              </button>
              {activeIndex < tourSteps.length - 1 ? (
                <button type='button' className='p7-public-tour-primary' onClick={goNext}>
                  Дальше <ChevronRight size={17} />
                </button>
              ) : (
                <button type='button' className='p7-public-tour-primary' onClick={goToRoles}>
                  Выбрать роль <ArrowRight size={17} />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .p7-public-tour-trigger {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 880;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          min-height: 48px;
          padding: 0 16px;
          border: 1px solid rgba(0, 122, 47, .24);
          border-radius: 999px;
          background: rgba(255,255,255,.93);
          color: #087a3b;
          box-shadow: 0 18px 40px rgba(7,22,17,.14);
          backdrop-filter: blur(16px);
          font: 900 14px/1 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          cursor: pointer;
        }
        .p7-public-tour-trigger:hover { transform: translateY(-1px); border-color: rgba(0,122,47,.42); }
        .p7-public-tour-trigger:focus-visible, .p7-public-tour-dialog button:focus-visible { outline: 3px solid rgba(0,122,47,.28); outline-offset: 3px; }
        .p7-public-tour-dialog:focus { outline: none; }
        .p7-public-tour-layer {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: grid;
          place-items: end center;
          padding: 20px;
          background: linear-gradient(180deg, rgba(7,22,17,.08), rgba(7,22,17,.36));
        }
        .p7-public-tour-dialog {
          width: min(760px, 100%);
          border: 1px solid rgba(7,22,17,.10);
          border-radius: 30px;
          background: rgba(252,254,250,.97);
          color: #071611;
          box-shadow: 0 34px 90px rgba(0,0,0,.22);
          overflow: hidden;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .p7-public-tour-topline {
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center;
          gap: 10px;
          padding: 16px 18px;
          border-bottom: 1px solid rgba(7,22,17,.08);
          background: rgba(246,250,245,.92);
        }
        .p7-public-tour-kicker { display: inline-flex; align-items: center; gap: 8px; color: #087a3b; font-size: 12px; font-weight: 950; letter-spacing: .045em; text-transform: uppercase; }
        .p7-public-tour-count { color: #66736e; font-size: 12px; font-weight: 900; }
        .p7-public-tour-close, .p7-public-tour-node, .p7-public-tour-primary, .p7-public-tour-secondary { border: 0; font-family: inherit; cursor: pointer; }
        .p7-public-tour-close { display: inline-grid; place-items: center; width: 38px; height: 38px; border-radius: 14px; background: #fff; color: #203029; box-shadow: inset 0 0 0 1px rgba(7,22,17,.09); }
        .p7-public-tour-body { display: grid; gap: 14px; padding: 18px; }
        .p7-public-tour-lead { margin: 0; color: #56615d; font-size: 13px; line-height: 1.35; font-weight: 800; }
        .p7-public-tour-stage { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
        .p7-public-tour-node { display: grid; place-items: center; min-height: 42px; border-radius: 15px; background: rgba(0,122,47,.06); color: #087a3b; box-shadow: inset 0 0 0 1px rgba(0,122,47,.11); }
        .p7-public-tour-node.active { background: #087a3b; color: #fff; box-shadow: 0 14px 30px rgba(0,122,47,.22); }
        .p7-public-tour-node.done { background: rgba(0,122,47,.12); }
        .p7-public-tour-card { display: grid; grid-template-columns: auto 1fr; gap: 16px; padding: clamp(18px, 3vw, 28px); border-radius: 24px; border: 1px solid rgba(7,22,17,.08); background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(241,248,239,.94)); }
        .p7-public-tour-icon { display: grid; place-items: center; width: 62px; height: 62px; border-radius: 22px; background: rgba(0,122,47,.10); color: #087a3b; }
        .p7-public-tour-card h2 { margin: 0; font-size: clamp(24px, 3.5vw, 38px); line-height: 1.03; letter-spacing: -.045em; font-weight: 950; }
        .p7-public-tour-card p { margin: 12px 0 0; color: #3e4a45; font-size: 16px; line-height: 1.45; font-weight: 650; }
        .p7-public-tour-list { display: grid; gap: 6px; margin: 13px 0 0; padding: 0; list-style: none; }
        .p7-public-tour-list li { position: relative; padding-left: 18px; color: #203029; font-size: 13px; line-height: 1.35; font-weight: 850; }
        .p7-public-tour-list li::before { content: ''; position: absolute; left: 0; top: .58em; width: 7px; height: 7px; border-radius: 999px; background: #087a3b; box-shadow: 0 0 0 4px rgba(0,122,47,.10); }
        .p7-public-tour-card strong { display: block; margin-top: 13px; color: #087a3b; font-size: 13px; line-height: 1.35; font-weight: 950; }
        .p7-public-tour-mini { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
        .p7-public-tour-mini span { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 42px; border-radius: 15px; background: rgba(255,255,255,.82); color: #203029; font-size: 12px; font-weight: 900; box-shadow: inset 0 0 0 1px rgba(7,22,17,.08); }
        .p7-public-tour-actions { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; padding: 0 18px 18px; }
        .p7-public-tour-primary, .p7-public-tour-secondary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; border-radius: 17px; font-size: 14px; font-weight: 950; }
        .p7-public-tour-primary { background: #087a3b; color: #fff; box-shadow: 0 16px 34px rgba(0,122,47,.22); }
        .p7-public-tour-secondary { background: #fff; color: #203029; box-shadow: inset 0 0 0 1px rgba(7,22,17,.10); }
        .p7-public-tour-secondary:disabled { cursor: not-allowed; opacity: .45; }
        @media (max-width: 640px) {
          .p7-public-tour-trigger { left: 14px; right: 14px; bottom: 14px; justify-content: center; min-height: 50px; }
          .p7-public-tour-layer { align-items: end; padding: 10px; }
          .p7-public-tour-dialog { border-radius: 26px; max-height: calc(100vh - 24px); overflow-y: auto; }
          .p7-public-tour-topline { padding: 13px 14px; }
          .p7-public-tour-body { padding: 14px; gap: 12px; }
          .p7-public-tour-lead { font-size: 12.5px; }
          .p7-public-tour-stage { gap: 6px; }
          .p7-public-tour-node { min-height: 38px; border-radius: 13px; }
          .p7-public-tour-card { grid-template-columns: 1fr; gap: 12px; padding: 17px; border-radius: 22px; }
          .p7-public-tour-icon { width: 54px; height: 54px; border-radius: 19px; }
          .p7-public-tour-card h2 { font-size: clamp(25px, 8vw, 34px); }
          .p7-public-tour-card p { font-size: 14.5px; line-height: 1.42; }
          .p7-public-tour-list li { font-size: 12.5px; }
          .p7-public-tour-mini { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .p7-public-tour-actions { grid-template-columns: 1fr; padding: 0 14px 14px; }
        }
      `}</style>
    </>
  );
}
