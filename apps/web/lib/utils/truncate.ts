export function truncateMiddle(str: string, maxLen = 40): string {
  if (str.length <= maxLen) return str;
  const half = Math.floor((maxLen - 3) / 2);
  return str.slice(0, half) + '…' + str.slice(str.length - half);
}

export function truncateLines(str: string, maxLines = 3, charsPerLine = 80): string {
  const maxChars = maxLines * charsPerLine;
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars).trimEnd() + '…';
}

// IDs (deal/lot/trip) — never truncate
export function formatId(id: string): string {
  return id;
}

export function truncateCounterparty(name: string): string {
  return truncateMiddle(name, 40);
}
