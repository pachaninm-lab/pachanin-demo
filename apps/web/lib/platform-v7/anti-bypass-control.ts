export type AntiBypassControlStrength = 'active' | 'partial' | 'requires_setup';

export type AntiBypassControlContext = 'seller' | 'buyer' | 'control-tower';

export interface AntiBypassControl {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly strength: AntiBypassControlStrength;
  readonly pilotEffect: string;
}

export const ANTI_BYPASS_STRENGTH_LABEL: Record<AntiBypassControlStrength, string> = {
  active: 'Активен в пилотном контуре',
  partial: 'Частично активен',
  requires_setup: 'Требует подключения',
};

const SHARED_CONTROLS: readonly AntiBypassControl[] = [
  {
    key: 'document_trail',
    name: 'Документальный след',
    description: 'ЭТрН, СДИЗ, акт приёмки и акт расхождения фиксируются внутри платформы',
    strength: 'partial',
    pilotEffect: 'снижает риск внеплатформенных договорённостей — документы сложнее скрыть или подменить вне контура',
  },
  {
    key: 'payment_reserve',
    name: 'Платёжный резерв',
    description: 'Резерв покупателя отмечен в пилотном контуре — ожидает банковского подтверждения',
    strength: 'partial',
    pilotEffect: 'затрудняет внеплатформенный расчёт — деньги не доступны напрямую без банковского события',
  },
  {
    key: 'dispute_evidence',
    name: 'Доказательства спора',
    description: 'Спорный доказательный пакет собирается внутри платформы',
    strength: 'partial',
    pilotEffect: 'сохраняет доказательства внутри платформы — внебиржевое урегулирование становится сложнее обосновать',
  },
  {
    key: 'route_audit',
    name: 'Маршрут и аудит',
    description: 'Журнал рейса и аудит событий создают трассировку исполнения',
    strength: 'active',
    pilotEffect: 'трассировка маршрута и действий снижает риск подмены физического факта вне платформы',
  },
  {
    key: 'counterparty_reliability',
    name: 'Надёжность контрагентов',
    description: 'Сигналы надёжности обеих сторон видимы в пилотном контуре',
    strength: 'partial',
    pilotEffect: 'проверка надёжности снижает риск выхода за контур — сохраняется история взаимодействия',
  },
];

export const ANTI_BYPASS_CONTROLS: Record<AntiBypassControlContext, readonly AntiBypassControl[]> = {
  seller: SHARED_CONTROLS,
  buyer: SHARED_CONTROLS,
  'control-tower': SHARED_CONTROLS,
};

export function getAntiBypassControls(context: AntiBypassControlContext): readonly AntiBypassControl[] {
  return ANTI_BYPASS_CONTROLS[context];
}

export function getActiveControlCount(context: AntiBypassControlContext): number {
  return ANTI_BYPASS_CONTROLS[context].filter((c) => c.strength === 'active').length;
}

export function getPartialControlCount(context: AntiBypassControlContext): number {
  return ANTI_BYPASS_CONTROLS[context].filter((c) => c.strength === 'partial').length;
}
