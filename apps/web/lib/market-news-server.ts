export async function getMarketNews(limit = 6) {
  return Array.from({ length: limit }).map((_, index) => ({
    id: `news-${index + 1}`,
    title: `Рыночный сигнал ${index + 1}`,
    source: 'fallback feed',
    time: '—',
    summary: 'Канонический feed пока не подключён. Этот блок показывает fallback-представление.'
  }));
}
