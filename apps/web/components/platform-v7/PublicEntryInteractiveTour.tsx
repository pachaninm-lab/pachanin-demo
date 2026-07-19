'use client';

import Link from 'next/link';
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
  Wheat,
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
    title: 'Цена зафиксирована. Риск только начинается',
    text: 'Согласование цены не завершает зерновую сделку. Дальше нужно удержать условия партии, базис поставки, допуски, сроки, документы и ответственность сторон в едином маршруте исполнения.',
    signal: 'Платформа нужна, чтобы после цены не терялись обязательства, сроки и основания для следующего действия.',
    checkpoints: ['Условия партии и базис поставки', 'Допуски, сроки и ответственные', 'Следующий шаг сделки'],
    Icon: ClipboardCheck,
  },
  {
    title: 'Рейс становится частью сделки',
    text: 'Партия связывается с транспортом, водителем, маршрутом, контрольными точками и плановым сроком доставки. Отклонение фиксируется как событие с причиной и ответственным действием.',
    signal: 'Логистика перестаёт быть отдельной перепиской и становится управляемым этапом исполнения.',
    checkpoints: ['Машина, водитель, маршрут', 'Контрольные точки и сроки', 'Причина отклонения от плана'],
    Icon: Truck,
  },
  {
    title: 'Приёмка и качество фиксируются как факт',
    text: 'Вес, влажность, сорность, класс, лабораторные показатели и отклонения от условий сделки фиксируются в структуре процесса. Расхождение переводится из устного обсуждения в проверяемое основание для решения.',
    signal: 'Для агробизнеса это критично: качество и вес напрямую влияют на расчёт, маржу и спорность сделки.',
    checkpoints: ['Вес и приёмочные показатели', 'Качество и источник данных', 'Отклонение от условий сделки'],
    Icon: FlaskConical,
  },
  {
    title: 'Документы закрывают юридическое основание',
    text: 'Договор, СДИЗ, ЭДО, транспортные и приёмочные документы собираются в карту готовности. Стороны видят, какой документ отсутствует, кто отвечает за его закрытие и какой этап из-за этого остановлен.',
    signal: 'Неполный комплект документов должен быть виден до расчёта, а не обнаруживаться после отгрузки.',
    checkpoints: ['Договор и подтверждающие документы', 'СДИЗ, ЭДО и транспортный контур', 'Ответственный за закрытие разрыва'],
    Icon: FileCheck2,
  },
  {
    title: 'Расчёт опирается на подтверждённое исполнение',
    text: 'Финансовый шаг должен опираться на поставку, приёмку, комплект документов, отсутствие критичного спора и понятное банковское основание. Покупатель видит, за что возникает обязанность оплаты; продавец — что именно мешает расчёту.',
    signal: 'Так снижается риск оплаты без основания и риск задержки оплаты без объяснимой причины.',
    checkpoints: ['Готовность к расчёту', 'Основание для оплаты', 'Причина удержания или остановки'],
    Icon: Banknote,
  },
  {
    title: 'Спор разбирается по материалам сделки',
    text: 'Если возникают расхождения по весу, качеству, срокам или документам, спор формируется из хронологии событий, документов, приёмочных данных, фото, GPS-меток, времени и действий сторон.',
    signal: 'Цель — быстрее перейти от конфликта к решению: что признано, что оспаривается и какие доказательства закрывают вопрос.',
    checkpoints: ['Доказательственный пакет', 'Хронология событий', 'Основание решения и следующий шаг'],
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
  const isContactPage = pathname === '/platform-v7/contact' || pathname === '/platform-v7/contact/';

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

  const goBackFromContact = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign('/platform-v7');
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus({ preventScroll: true });

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

  if (isContactPage) {
    return (
      <>
        <header className='p7-contact-fixed-header' aria-label='Навигация страницы обращения'>
          <button type='button' className='p7-contact-fixed-back' onClick={goBackFromContact} aria-label='Назад'>
            <ChevronLeft size={19} strokeWidth={2.5} />
            <span>Назад</span>
          </button>
          <Link href='/platform-v7' className='p7-contact-fixed-brand' aria-label='На главную Прозрачная Цена'>
            <span className='p7-contact-fixed-logo'><Wheat size={22} strokeWidth={2.45} /></span>
            <span className='p7-contact-fixed-title'>Прозрачная Цена</span>
          </Link>
          <Link href='/platform-v7/demo' className='p7-contact-fixed-demo'>Демо</Link>
        </header>
        <style>{`
          .pc-shell-root-v4:has(.p7-contact-page) .p7-contact-header { display: none !important; }
          .pc-shell-root-v4:has(.p7-contact-page) .pc-v4-main { padding-top: 0 !important; }
          .pc-shell-root-v4:has(.p7-contact-page) .p7-contact-page {
            padding-top: 78px !important;
          }
          .p7-contact-fixed-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 2800;
            min-height: 62px;
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            align-items: center;
            gap: 10px;
            padding: max(8px, env(safe-area-inset-top)) clamp(12px, 3vw, 22px) 8px;
            border-bottom: 1px solid rgba(7, 22, 17, .08);
            background: rgba(255,255,255,.97);
            box-shadow: 0 12px 30px rgba(7,22,17,.08);
            -webkit-backdrop-filter: blur(18px);
            backdrop-filter: blur(18px);
            color: #071611;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .p7-contact-fixed-header a { color: inherit; text-decoration: none; }
          .p7-contact-fixed-back,
          .p7-contact-fixed-demo {
            min-height: 42px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            border-radius: 14px;
            border: 1px solid rgba(7,22,17,.10);
            background: rgba(255,255,255,.88);
            color: #14241d;
            font: 900 13px/1 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 8px 20px rgba(7,22,17,.05);
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
          }
          .p7-contact-fixed-back { padding: 0 11px 0 9px; }
          .p7-contact-fixed-demo { padding: 0 13px; color: #087a3b; background: rgba(0,122,47,.07); }
          .p7-contact-fixed-brand {
            min-width: 0;
            justify-self: center;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            font-weight: 950;
            letter-spacing: -.035em;
            white-space: nowrap;
          }
          .p7-contact-fixed-logo {
            display: grid;
            place-items: center;
            width: 40px;
            height: 40px;
            border-radius: 14px;
            color: #087a3b;
            background: rgba(0,122,47,.08);
          }
          .p7-contact-fixed-title {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 17px;
          }
          @media (max-width: 760px) {
            .pc-shell-root-v4:has(.p7-contact-page) .p7-contact-page { padding-top: 66px !important; }
            .p7-contact-fixed-header {
              min-height: 58px;
              grid-template-columns: auto minmax(0, 1fr) auto;
              gap: 7px;
              padding: max(7px, env(safe-area-inset-top)) 10px 7px;
            }
            .p7-contact-fixed-back,
            .p7-contact-fixed-demo { min-height: 40px; border-radius: 13px; font-size: 12.5px; }
            .p7-contact-fixed-back { padding: 0 10px 0 8px; }
            .p7-contact-fixed-demo { padding: 0 11px; }
            .p7-contact-fixed-logo { width: 38px; height: 38px; border-radius: 13px; }
            .p7-contact-fixed-title { font-size: 16px; }
          }
          @media (max-width: 390px) {
            .p7-contact-fixed-back span { display: none; }
            .p7-contact-fixed-back { width: 40px; padding: 0; }
            .p7-contact-fixed-title { font-size: 15px; }
            .p7-contact-fixed-demo { font-size: 12px; padding: 0 9px; }
          }
        `}</style>
      </>
    );
  }

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
        <span>Посмотреть путь сделки</span>
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
              <span className='p7-public-tour-kicker'><ShieldCheck size={16} /> Контур исполнения сделки</span>
              <span className='p7-public-tour-count'>{progressText}</span>
              <button type='button' className='p7-public-tour-close' aria-label='Закрыть тур' onClick={closeTour}>
                <X size={18} />
              </button>
            </div>

            <div className='p7-public-tour-body'>
              <p className='p7-public-tour-lead'>Короткий маршрут показывает, где внебиржевая зерновая сделка обычно теряет управляемость: условия, рейс, приёмка, документы, расчёт и спор.</p>

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
                  <ul className='p7-public-tour-list' aria-label='Что контролируется на этом этапе'>
                    {activeStep.checkpoints.map((checkpoint) => (
                      <li key={checkpoint}>{checkpoint}</li>
                    ))}
                  </ul>
                  <strong>{activeStep.signal}</strong>
                </div>
              </section>

              <div className='p7-public-tour-mini' aria-label='Суть платформы'>
                <span><Building2 size={16} /> Условия</span>
                <span><Truck size={16} /> Исполнение</span>
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
          bottom: max(22px, env(safe-area-inset-bottom));
          z-index: 1500;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 48px;
          padding: 0 17px;
          border: 1px solid rgba(0, 122, 47, .24);
          border-radius: 999px;
          background: rgba(255,255,255,.94);
          color: #087a3b;
          box-shadow: 0 18px 40px rgba(7,22,17,.14);
          backdrop-filter: blur(16px);
          font: 900 14px/1 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .p7-public-tour-trigger:hover { transform: translateY(-1px); border-color: rgba(0,122,47,.42); }
        .p7-public-tour-trigger:focus-visible, .p7-public-tour-dialog button:focus-visible { outline: 3px solid rgba(0,122,47,.28); outline-offset: 3px; }
        .p7-public-tour-dialog:focus { outline: none; }
        .p7-public-tour-layer {
          position: fixed;
          inset: 0;
          z-index: 2600;
          display: grid;
          place-items: center;
          padding: max(12px, env(safe-area-inset-top)) 22px max(12px, env(safe-area-inset-bottom));
          background: linear-gradient(180deg, rgba(7,22,17,.18), rgba(7,22,17,.50));
          overscroll-behavior: contain;
        }
        .p7-public-tour-dialog {
          position: relative;
          width: min(840px, 100%);
          max-height: calc(100dvh - 44px);
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(7,22,17,.10);
          border-radius: 30px;
          background: rgba(252,254,250,.98);
          color: #071611;
          box-shadow: 0 34px 90px rgba(0,0,0,.26);
          overflow: hidden;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .p7-public-tour-topline {
          position: sticky;
          top: 0;
          z-index: 3;
          flex: 0 0 auto;
          display: grid;
          grid-template-columns: minmax(0,1fr) auto 46px;
          align-items: center;
          gap: 10px;
          min-height: 62px;
          padding: 10px 12px 10px 18px;
          border-bottom: 1px solid rgba(7,22,17,.08);
          background: rgba(246,250,245,.98);
          box-shadow: 0 10px 22px rgba(7,22,17,.08);
        }
        .p7-public-tour-kicker { min-width: 0; display: inline-flex; align-items: center; gap: 8px; color: #087a3b; font-size: 12px; font-weight: 950; letter-spacing: .045em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .p7-public-tour-count { color: #66736e; font-size: 12px; font-weight: 900; white-space: nowrap; }
        .p7-public-tour-close, .p7-public-tour-node, .p7-public-tour-primary, .p7-public-tour-secondary { border: 0; font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .p7-public-tour-close {
          display: inline-grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border-radius: 16px;
          background: #fff;
          color: #203029;
          box-shadow: inset 0 0 0 1px rgba(7,22,17,.10), 0 8px 18px rgba(7,22,17,.08);
          justify-self: end;
          flex: 0 0 auto;
        }
        .p7-public-tour-body { flex: 1 1 auto; min-height: 0; display: grid; gap: 14px; padding: 18px; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
        .p7-public-tour-lead { margin: 0; color: #56615d; font-size: 14px; line-height: 1.4; font-weight: 800; max-width: 720px; }
        .p7-public-tour-stage { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
        .p7-public-tour-node { display: grid; place-items: center; min-height: 42px; border-radius: 15px; background: rgba(0,122,47,.06); color: #087a3b; box-shadow: inset 0 0 0 1px rgba(0,122,47,.11); }
        .p7-public-tour-node.active { background: #087a3b; color: #fff; box-shadow: 0 14px 30px rgba(0,122,47,.22); }
        .p7-public-tour-node.done { background: rgba(0,122,47,.12); }
        .p7-public-tour-card { display: grid; grid-template-columns: auto 1fr; gap: 16px; padding: clamp(20px, 3vw, 30px); border-radius: 24px; border: 1px solid rgba(7,22,17,.08); background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(241,248,239,.94)); }
        .p7-public-tour-icon { display: grid; place-items: center; width: 62px; height: 62px; border-radius: 22px; background: rgba(0,122,47,.10); color: #087a3b; }
        .p7-public-tour-card h2 { margin: 0; font-size: clamp(25px, 3vw, 36px); line-height: 1.04; letter-spacing: -.045em; font-weight: 950; }
        .p7-public-tour-card p { margin: 12px 0 0; color: #3e4a45; font-size: 16px; line-height: 1.48; font-weight: 650; }
        .p7-public-tour-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin: 14px 0 0; padding: 0; list-style: none; }
        .p7-public-tour-list li { position: relative; min-height: 38px; padding: 9px 10px 9px 24px; border-radius: 13px; background: rgba(255,255,255,.78); color: #203029; font-size: 12.5px; line-height: 1.25; font-weight: 850; box-shadow: inset 0 0 0 1px rgba(7,22,17,.07); }
        .p7-public-tour-list li::before { content: ''; position: absolute; left: 11px; top: 15px; width: 6px; height: 6px; border-radius: 999px; background: #087a3b; box-shadow: 0 0 0 4px rgba(0,122,47,.10); }
        .p7-public-tour-card strong { display: block; margin-top: 14px; color: #087a3b; font-size: 13.5px; line-height: 1.38; font-weight: 950; }
        .p7-public-tour-mini { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
        .p7-public-tour-mini span { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 42px; border-radius: 15px; background: rgba(255,255,255,.84); color: #203029; font-size: 12px; font-weight: 900; box-shadow: inset 0 0 0 1px rgba(7,22,17,.08); }
        .p7-public-tour-actions { flex: 0 0 auto; display: grid; grid-template-columns: 1fr 1.45fr; gap: 10px; padding: 0 18px 18px; background: rgba(252,254,250,.98); }
        .p7-public-tour-primary, .p7-public-tour-secondary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 54px; border-radius: 17px; font-size: 14px; font-weight: 950; }
        .p7-public-tour-primary { background: #087a3b; color: #fff; box-shadow: 0 16px 34px rgba(0,122,47,.22); }
        .p7-public-tour-secondary { background: #fff; color: #203029; box-shadow: inset 0 0 0 1px rgba(7,22,17,.10); }
        .p7-public-tour-secondary:disabled { cursor: not-allowed; opacity: .45; }
        @media (max-width: 760px) {
          .p7-public-tour-trigger {
            left: 50%;
            right: auto;
            bottom: max(18px, env(safe-area-inset-bottom));
            width: min(520px, calc(100dvw - 44px));
            min-height: 54px;
            padding: 0 18px;
            transform: translateX(-50%);
            justify-content: center;
            text-align: center;
            z-index: 1500;
          }
          .p7-public-tour-trigger:hover { transform: translateX(-50%) translateY(-1px); }
          .p7-public-tour-trigger span { display: inline-block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .p7-public-tour-layer { place-items: end center; padding: max(8px, env(safe-area-inset-top)) 8px max(8px, env(safe-area-inset-bottom)); }
          .p7-public-tour-dialog { width: 100%; max-height: calc(100dvh - 16px); border-radius: 26px; }
          .p7-public-tour-topline { grid-template-columns: minmax(0,1fr) 46px; min-height: 58px; padding: 8px 10px 8px 12px; gap: 8px; }
          .p7-public-tour-kicker { font-size: 10.5px; letter-spacing: .035em; }
          .p7-public-tour-count { display: none; }
          .p7-public-tour-close { width: 44px; height: 44px; border-radius: 16px; }
          .p7-public-tour-body { padding: 14px; gap: 12px; }
          .p7-public-tour-lead { font-size: 12.8px; line-height: 1.36; }
          .p7-public-tour-stage { gap: 6px; }
          .p7-public-tour-node { min-height: 38px; border-radius: 13px; }
          .p7-public-tour-card { grid-template-columns: 1fr; gap: 12px; padding: 17px; border-radius: 22px; }
          .p7-public-tour-icon { width: 54px; height: 54px; border-radius: 19px; }
          .p7-public-tour-card h2 { font-size: clamp(24px, 7.2vw, 32px); line-height: 1.04; letter-spacing: -.05em; }
          .p7-public-tour-card p { font-size: 14.2px; line-height: 1.43; }
          .p7-public-tour-list { grid-template-columns: 1fr; gap: 6px; }
          .p7-public-tour-list li { min-height: 34px; font-size: 12.5px; }
          .p7-public-tour-card strong { font-size: 12.8px; line-height: 1.34; }
          .p7-public-tour-mini { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .p7-public-tour-actions { grid-template-columns: 1fr; padding: 0 14px 14px; }
          .p7-public-tour-primary, .p7-public-tour-secondary { min-height: 52px; }
        }
        @media (max-width: 390px) {
          .p7-public-tour-trigger { width: min(360px, calc(100dvw - 28px)); }
          .p7-public-tour-card h2 { font-size: 23px; }
          .p7-public-tour-card p { font-size: 13.6px; }
          .p7-public-tour-mini span { font-size: 11.5px; }
        }
        @media (max-height: 690px) and (max-width: 760px) {
          .p7-public-tour-lead { display: none; }
          .p7-public-tour-icon { width: 48px; height: 48px; border-radius: 17px; }
          .p7-public-tour-card { padding: 15px; }
          .p7-public-tour-card strong { margin-top: 10px; }
        }
      `}</style>
    </>
  );
}
