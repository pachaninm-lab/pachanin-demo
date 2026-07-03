/**
 * Ребейз дат демо-фикстур относительно реального «сейчас».
 *
 * Фикстуры написаны с абсолютными датами вокруг условного «сегодня» авторов
 * (FIXTURE_NOW). Без сдвига любой посетитель после этой даты видит платформу,
 * забитую просроченными на месяцы сделками, а захардкоженный slaDaysLeft
 * противоречит дате рядом. Сдвиг целыми сутками сохраняет время суток событий
 * («резерв подтверждён в 14:22») и взаимные интервалы таймлайна.
 */
const FIXTURE_NOW_MS = Date.parse('2026-04-17T10:00:00Z');
const DAY_MS = 86_400_000;

export function fixtureShiftMs(now: number = Date.now()): number {
  return Math.floor((now - FIXTURE_NOW_MS) / DAY_MS) * DAY_MS;
}

/** Сдвигает ISO-дату ('2026-04-19' или полный timestamp) на целое число суток к «сейчас». */
export function rebaseFixtureIso(iso: string, now?: number): string;
export function rebaseFixtureIso(iso: string | null, now?: number): string | null;
export function rebaseFixtureIso(iso: string | null, now: number = Date.now()): string | null {
  if (!iso) return iso;
  const parsed = Date.parse(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(parsed)) return iso;
  const shifted = new Date(parsed + fixtureShiftMs(now));
  return iso.length <= 10 ? shifted.toISOString().slice(0, 10) : shifted.toISOString();
}

/** Дней до дедлайна от «сейчас» (округление вверх; 0 — сегодня, отрицательное — просрочен). */
export function daysLeftFrom(deadlineIso: string | null, now: number = Date.now()): number | null {
  if (!deadlineIso) return null;
  const iso = deadlineIso.length <= 10 ? `${deadlineIso}T23:59:59Z` : deadlineIso;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return Math.ceil((parsed - now) / DAY_MS);
}
