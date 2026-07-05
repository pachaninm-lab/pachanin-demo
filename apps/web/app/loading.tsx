export default function Loading() {
  return (
    <main
      style={{
        minHeight: '100svh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#fbfcf9',
        color: '#071611',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      }}
    >
      <section style={{ display: 'grid', gap: 12, justifyItems: 'center', textAlign: 'center' }}>
        <div
          aria-hidden="true"
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            border: '4px solid rgba(8,122,59,.16)',
            borderTopColor: '#087a3b',
            animation: 'pcSpin .8s linear infinite',
          }}
        />
        <strong style={{ fontSize: 18, letterSpacing: '-.03em' }}>Загружаем платформу</strong>
        <span style={{ maxWidth: 320, fontSize: 13, lineHeight: 1.45, color: '#5e6b66' }}>
          Идёт открытие публичного контура «Прозрачная Цена».
        </span>
      </section>
      <style>{'@keyframes pcSpin{to{transform:rotate(360deg)}}'}</style>
    </main>
  );
}
