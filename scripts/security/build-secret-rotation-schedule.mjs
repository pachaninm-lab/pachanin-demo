#!/usr/bin/env node
/**
 * Расписание ротации секретов (ASVS V13.1.4).
 *
 * Порождается из docs/security/cryptographic-key-usage.json, где расписание живёт
 * рядом с границей применения ключа. Отдельного источника правды здесь нет
 * намеренно: два списка секретов разойдутся, и разойдутся молча.
 *
 * SECRET_ROTATION_REGISTER.md - отчёт сканера («ни одного открытого секрета»), а
 * не расписание. Это разные вопросы, и они остаются в разных файлах.
 */
import { readFileSync, writeFileSync } from 'node:fs';

export const USAGE = 'docs/security/cryptographic-key-usage.json';
export const SCHEDULE = 'docs/security/SECRET_ROTATION_SCHEDULE.md';

const CRITICALITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'NON_PRODUCTION'];

const SUPPORT_RU = {
  OVERLAPPING_KEYS: 'без простоя: принимаются несколько ключей с окнами действия',
  COORDINATED_CUTOVER: 'согласованный переход с инвалидацией того, что подписано старым',
  DATA_MIGRATION_REQUIRED: 'требует миграции данных, календарно невыполнима',
  PROVIDER_REVOCABLE: 'отзывается и перевыпускается у провайдера',
  EPHEMERAL: 'существует только на время прогона',
};

const CADENCE_RU = {
  CALENDAR: (days) => `каждые ${days} дн.`,
  EVENT_DRIVEN: () => 'по событию',
  PER_RUN: () => 'на каждый прогон',
};

export function scheduleRows(usage) {
  return (usage.keys || [])
    .filter((entry) => entry.kind === 'secret' && entry.rotation)
    .sort((left, right) => {
      const byCriticality = CRITICALITY_ORDER.indexOf(left.rotation.criticality)
        - CRITICALITY_ORDER.indexOf(right.rotation.criticality);
      return byCriticality !== 0 ? byCriticality : left.name.localeCompare(right.name, 'en');
    });
}

export function renderSchedule(usage) {
  const rows = scheduleRows(usage);
  const calendar = rows.filter((entry) => entry.rotation.cadence === 'CALENDAR');
  const eventDriven = rows.filter((entry) => entry.rotation.cadence === 'EVENT_DRIVEN');

  const lines = [
    '# Расписание ротации секретов',
    '',
    'Сгенерировано `scripts/security/build-secret-rotation-schedule.mjs` из',
    '`docs/security/cryptographic-key-usage.json`. Не редактировать вручную.',
    '',
    'Расписание живёт рядом с границей применения ключа, а не в отдельном списке:',
    'два списка секретов разойдутся, и разойдутся молча.',
    '',
    `Секретов: ${rows.length}. По календарю: ${calendar.length}. По событию: ${eventDriven.length}.`,
    '',
    'Единого интервала для всего намеренно нет. Материал, смена которого требует',
    'миграции данных, календарной даты не несёт: записать для него срок значило бы',
    'записать расписание, которое никто не выполнит.',
    '',
    '| Секрет | Критичность | Периодичность | Как меняется | Что даёт компрометация |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const entry of rows) {
    const { criticality, cadence, intervalDays, rotationSupport, blastRadius } = entry.rotation;
    lines.push([
      '',
      `\`${entry.name}\``,
      criticality,
      CADENCE_RU[cadence](intervalDays),
      SUPPORT_RU[rotationSupport],
      blastRadius,
      '',
    ].join(' | ').trim());
  }

  lines.push('', '## Обоснование', '');
  for (const entry of rows) {
    lines.push(`### \`${entry.name}\``, '', entry.rotation.rationale, '');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function main() {
  const usage = JSON.parse(readFileSync(USAGE, 'utf8'));
  const rendered = renderSchedule(usage);
  writeFileSync(SCHEDULE, rendered);
  const rows = scheduleRows(usage);
  console.log(
    `SECRET_ROTATION_SCHEDULE: secrets=${rows.length} calendar=${rows.filter((e) => e.rotation.cadence === 'CALENDAR').length} eventDriven=${rows.filter((e) => e.rotation.cadence === 'EVENT_DRIVEN').length}`,
  );
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
