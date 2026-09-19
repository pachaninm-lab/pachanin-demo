export function CardSkeleton() {
  return (
    <div className="section-card-tight">
      <div className="skeleton-line" style={{ width: '35%', height: 18 }} />
      <div className="skeleton-line" style={{ width: '100%', height: 14, marginTop: 10 }} />
      <div className="skeleton-line" style={{ width: '82%', height: 14, marginTop: 8 }} />
    </div>
  );
}
