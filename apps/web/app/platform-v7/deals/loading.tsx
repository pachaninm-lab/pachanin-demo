export default function DealsLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ width: 220, height: 28, borderRadius: 8, background: '#F4F5F7' }} />
      <div style={{ border: '1px solid #E4E6EA', borderRadius: 12, overflow: 'hidden' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.3fr 0.9fr 0.9fr 0.6fr 0.6fr', gap: 12, padding: '14px 16px', borderBottom: i < 7 ? '1px solid #F4F5F7' : 'none' }}>
            {Array.from({ length: 7 }).map((__, j) => (
              <div key={j} style={{ height: 14, borderRadius: 6, background: '#F4F5F7' }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
