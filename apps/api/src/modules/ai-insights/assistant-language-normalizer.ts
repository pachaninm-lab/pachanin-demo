const REPLACEMENTS: Readonly<Record<string, string>> = Object.freeze({
  палучить: 'получить', денги: 'деньги', деньгы: 'деньги', аплата: 'оплата',
  виплата: 'выплата', зделка: 'сделка', аукцыон: 'аукцион', преемка: 'приёмка',
  приемка: 'приёмка', лабаратория: 'лаборатория', документи: 'документы',
  дакументы: 'документы', догавор: 'договор', сдис: 'сдиз', фгисзерно: 'фгис зерно',
  номиналный: 'номинальный', счот: 'счёт', регестрация: 'регистрация',
  памощник: 'помощник', sdelka: 'сделка', dengi: 'деньги', oplata: 'оплата',
  podderzhka: 'поддержка', бабки: 'деньги', средства: 'деньги',
  платеж: 'оплата', платёж: 'оплата', фура: 'перевозка', грузовик: 'перевозка',
  склад: 'элеватор', контракт: 'договор', жалоба: 'претензия',
});

const VOCABULARY = Object.freeze([
  'сделка', 'аукцион', 'ставка', 'лот', 'допуск', 'логистика', 'перевозка', 'водитель',
  'элеватор', 'приёмка', 'лаборатория', 'качество', 'документы', 'договор', 'акт',
  'сдиз', 'фгис', 'деньги', 'оплата', 'выплата', 'резерв', 'расчёт', 'банк',
  'спор', 'претензия', 'доказательства', 'доступ', 'роль', 'поддержка', 'статус', 'риск',
]);

function distance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, row) =>
    Array.from({ length: b.length + 1 }, (_, column) => row === 0 ? column : column === 0 ? row : 0));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }
  return matrix[a.length][b.length];
}

function fuzzy(token: string): string {
  if (token.length < 5 || /^\d+$/u.test(token)) return token;
  let best = token;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of VOCABULARY) {
    if (Math.abs(candidate.length - token.length) > 2) continue;
    const current = distance(token, candidate);
    if (current < bestDistance) { best = candidate; bestDistance = current; }
  }
  const threshold = token.length <= 8 ? 2 : 3;
  return bestDistance <= threshold ? best : token;
}

export function normalizeAssistantQuestion(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim()
    .split(' ')
    .map((raw) => {
      const token = raw.toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е').replace(/[^\p{L}\p{N}._-]/gu, '');
      if (!token) return raw;
      return REPLACEMENTS[token] ?? fuzzy(token);
    })
    .join(' ')
    .slice(0, 4_000);
}
