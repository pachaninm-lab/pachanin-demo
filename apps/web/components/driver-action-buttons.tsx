'use client';

export function DriverActionButtons({
  onConfirm,
  onIncident,
}: {
  onConfirm?: () => void;
  onIncident?: () => void;
}) {
  return (
    <div className="cta-stack">
      <button className="button primary compact" onClick={onConfirm}>Подтвердить этап</button>
      <button className="button secondary compact" onClick={onIncident}>Сообщить об инциденте</button>
    </div>
  );
}
