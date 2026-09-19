import type { DayData } from './PaymentHeatmap';

// Demo data for March 2024. Server-safe (no 'use client') so Server Components
// can call it; a plain function imported through the 'use client' module would
// become a non-callable client-reference proxy.
export function buildDemoPaymentHeatmapData(): DayData[] {
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
