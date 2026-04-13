export default function DisputesLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ width: 180, height: 28, borderRadius: 8, background: '#F4F5F7' }} />
      <div style={{ border: '1px solid #E4E6EA', borderRadius: 12, overflow: 'hidden' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr 1.6fr 0.8fr 0.6fr 0.7fr', gap: 12, padding: '14px 16px', borderBottom: i < 5 ? '1px solid #F4F5F7' : 'none' }}>
            {Array.from({ length: 7 }).map((__, j) => (
              <div key={j} style={{ height: 14, borderRadius: 6, background: '#F4F5F7' }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
