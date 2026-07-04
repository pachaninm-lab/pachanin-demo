// Серверобезопасный модуль демо-данных heatmap'а выплат. Вынесен из
// PaymentHeatmap.tsx: тот помечен 'use client', и вызов функции, экспортированной
// из клиентского модуля, из серверной страницы падает на пререндере
// («TypeError: z is not a function» — вместо функции приходит client reference).

export interface PaymentHeatmapDay {
  date: string; // 'YYYY-MM-DD'
  amountKopecks: number;
  dealCount: number;
}

// Demo data for March 2024
export function buildDemoPaymentHeatmapData(): PaymentHeatmapDay[] {
  return [
    { date: '2024-03-01', amountKopecks: 180_000_00, dealCount: 2 },
    { date: '2024-03-05', amountKopecks: 95_000_00,  dealCount: 1 },
    { date: '2024-03-07', amountKopecks: 450_000_00, dealCount: 3 },
    { date: '2024-03-12', amountKopecks: 120_000_00, dealCount: 1 },
    { date: '2024-03-15', amountKopecks: 820_000_00, dealCount: 5 },
    { date: '2024-03-18', amountKopecks: 340_000_00, dealCount: 2 },
    { date: '2024-03-20', amountKopecks: 65_000_00,  dealCount: 1 },
    { date: '2024-03-25', amountKopecks: 290_000_00, dealCount: 2 },
    { date: '2024-03-28', amountKopecks: 760_000_00, dealCount: 4 },
  ];
}
