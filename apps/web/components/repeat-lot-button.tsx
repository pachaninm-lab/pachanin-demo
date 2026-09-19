'use client';

export function RepeatLotButton({ onRepeat }: { onRepeat?: () => void }) {
  return <button className="button secondary compact" onClick={onRepeat}>Повторить лот</button>;
}
