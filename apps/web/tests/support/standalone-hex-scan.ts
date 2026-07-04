import { readFileSync } from 'node:fs';

// Считает «стоячие» цветовые литералы в файле — те, что НЕ theme-aware:
//  - hex #rrggbb / #rgb, НЕ являющиеся фолбэком внутри var(--token, #hex)
//  - rgb()/rgba() с числовыми каналами (тоже фиксированный цвет)
// Литералы в var(--token, ...) не считаются: токен несёт тему, фолбэк — лишь
// страховка. Это метрика долга тёмной темы: чем ниже, тем больше поверхностей
// переключаются светлая/тёмная автоматически.
//
// Осознанные исключения помечаются строковым комментарием `theme-exempt`
// в той же строке (например, фиксированные декоративные градиенты или
// бренд-цвета логотипов) и в подсчёт не идут.

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const VAR_FALLBACK_HEX = /var\(\s*--[a-z0-9-]+\s*,\s*#[0-9a-fA-F]{3,8}\s*\)/g;
const RGB_FUNC = /\brgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g;

export function countStandaloneColors(source: string): number {
  let count = 0;
  for (const rawLine of source.split('\n')) {
    if (rawLine.includes('theme-exempt')) continue;
    const line = rawLine.replace(VAR_FALLBACK_HEX, ''); // убрать фолбэки в var()
    const hex = line.match(HEX)?.length ?? 0;
    const rgb = line.match(RGB_FUNC)?.length ?? 0;
    count += hex + rgb;
  }
  return count;
}

export function countStandaloneColorsInFile(absPath: string): number {
  return countStandaloneColors(readFileSync(absPath, 'utf8'));
}
