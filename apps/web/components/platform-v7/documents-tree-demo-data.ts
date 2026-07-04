// Серверобезопасный модуль демо-данных дерева документов. Вынесен из
// DocumentsTree.tsx ('use client'): вызов функции из клиентского модуля
// в серверной странице падает на пререндере (client reference вместо функции).

import type { DocumentYear } from './DocumentsTree';

// Demo data factory
export function buildDemoDocumentTree(): DocumentYear[] {
  return [
    {
      year: 2024,
      months: [
        {
          month: 3,
          label: 'Март 2024',
          deals: [
            {
              dealId: 'DL-9106',
              dealLabel: 'Пшеница 3кл · 120 т · Ростов→Новороссийск',
              documents: [
                { id: 'd1', name: 'Договор купли-продажи DL-9106', type: 'CONTRACT', status: 'SIGNED', dealId: 'DL-9106', sizeKb: 214, signedAt: '2024-03-01T10:02:00Z' },
                { id: 'd2', name: 'ТТН ТМБ-14', type: 'TTN', status: 'SIGNED', dealId: 'DL-9106', sizeKb: 88 },
                { id: 'd3', name: 'ЭТрН ВРЖ-08', type: 'ETTN', status: 'GENERATED', dealId: 'DL-9106', sizeKb: 45 },
                { id: 'd4', name: 'СДИЗ LOT-2403', type: 'SDIZ', status: 'MISSING', dealId: 'DL-9106' },
                { id: 'd5', name: 'Весовой талон 2024-0312', type: 'WEIGH_TICKET', status: 'SIGNED', dealId: 'DL-9106', sizeKb: 32 },
                { id: 'd6', name: 'Протокол качества SMPL-1204', type: 'LAB_PROTOCOL', status: 'GENERATED', dealId: 'DL-9106', sizeKb: 128 },
              ],
            },
            {
              dealId: 'DL-9102',
              dealLabel: 'Ячмень 2кл · 85 т · Краснодар→Тамань',
              documents: [
                { id: 'd7', name: 'Договор купли-продажи DL-9102', type: 'CONTRACT', status: 'SIGNED', dealId: 'DL-9102', sizeKb: 198 },
                { id: 'd8', name: 'Акт приёма DL-9102', type: 'ACT', status: 'DISPUTED', dealId: 'DL-9102', sizeKb: 64 },
                { id: 'd9', name: 'Протокол расхождения качества', type: 'LAB_PROTOCOL', status: 'SIGNED', dealId: 'DL-9102', sizeKb: 145 },
              ],
            },
          ],
        },
      ],
    },
  ];
}
