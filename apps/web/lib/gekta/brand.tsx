export const GEKTA_BRAND = { background: '#214837', ink: '#e9f2d1', accent: '#b8d99b' } as const;

export function GektaGlyph({ size }: { size: number }) {
  const unit = size / 24;
  return (
    <span aria-hidden='true' style={{ display: 'flex', position: 'relative', flexShrink: 0, width: size, height: size }}>
      <span style={{
        position: 'absolute', left: 3 * unit, top: 3 * unit, width: 18 * unit, height: 4 * unit,
        borderRadius: `${4 * unit}px ${2 * unit}px ${2 * unit}px 0`, background: GEKTA_BRAND.ink,
      }} />
      <span style={{
        position: 'absolute', left: 3 * unit, top: 6 * unit, width: 4 * unit, height: 15 * unit,
        borderRadius: `0 0 ${2 * unit}px ${2 * unit}px`, background: GEKTA_BRAND.ink,
      }} />
      <span style={{
        position: 'absolute', left: 10 * unit, top: 10 * unit, width: 10 * unit, height: 3.8 * unit,
        borderRadius: 2 * unit, background: GEKTA_BRAND.accent,
      }} />
      <span style={{
        position: 'absolute', left: 10 * unit, top: 17 * unit, width: 7 * unit, height: 3.8 * unit,
        borderRadius: 2 * unit, background: GEKTA_BRAND.accent,
      }} />
    </span>
  );
}
