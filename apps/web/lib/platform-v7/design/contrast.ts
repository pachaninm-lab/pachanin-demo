function normalizeHex(hex: string): string {
  const clean = hex.trim().replace('#', '');
  if (clean.length !== 6) {
    throw new Error(`Expected 6-digit hex color, received: ${hex}`);
  }
  return clean;
}

function hexToRgb(hex: string): readonly [number, number, number] {
  const clean = normalizeHex(hex);
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function srgbToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function meetsWcagAaText(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= 4.5;
}

export function meetsWcagAaLargeTextOrUi(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= 3;
}
