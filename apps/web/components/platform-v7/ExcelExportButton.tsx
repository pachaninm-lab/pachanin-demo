'use client';

import { useState } from 'react';

export type ExcelExportDataset = 'deals' | 'lots' | 'disputes' | 'payments';

interface Props {
  dataset?: ExcelExportDataset;
  label?: string;
}

const DATASET_LABEL: Record<ExcelExportDataset, string> = {
  deals: 'Реестр сделок',
  lots: 'Реестр лотов',
  disputes: 'Реестр споров',
  payments: 'Реестр выплат',
};

type CellValue = string | number | Date | boolean;

interface SheetData {
  name: string;
  columns: string[];
  rows: CellValue[][];
}

function buildDealsData(): SheetData {
  return {
    name: 'Сделки',
    columns: ['ID', 'Лот', 'Культура', 'Статус', 'Зарезервировано (₽)', 'Удержано (₽)', 'Регион', 'Контрагент', 'Создана'],
    rows: [
      ['DL-9102', 'LOT-2401', 'Пшеница 3 кл', 'Спор', 4_200_000, 320_000, 'Тамбовская обл.', 'ООО Агро-Юг', new Date('2024-03-15')],
      ['DL-9103', 'LOT-2402', 'Ячмень', 'Активна', 2_800_000, 0, 'Воронежская обл.', 'ООО Зернотрейд', new Date('2024-03-18')],
      ['DL-9104', 'LOT-2403', 'Кукуруза', 'Выплата разрешена', 6_100_000, 0, 'Курская обл.', 'ИП Фермеров К.С.', new Date('2024-03-20')],
      ['DL-9105', 'LOT-2404', 'Подсолнечник', 'Банк проверяет', 9_400_000, 0, 'Липецкая обл.', 'АО Маслопром', new Date('2024-03-22')],
      ['DL-9106', 'LOT-2405', 'Соя', 'Блокирована', 3_700_000, 1_170_000, 'Тамбовская обл.', 'ООО Соевый Альянс', new Date('2024-03-25')],
      ['DL-9109', 'LOT-2408', 'Пшеница 4 кл', 'Выплата разрешена', 10_500_000, 0, 'Воронежская обл.', 'ООО Элеватор-Плюс', new Date('2024-04-01')],
      ['DL-9110', 'LOT-2409', 'Рожь', 'Активна', 1_900_000, 0, 'Орловская обл.', 'ФГУ Росрезерв', new Date('2024-04-03')],
    ],
  };
}

function buildLotsData(): SheetData {
  return {
    name: 'Лоты',
    columns: ['ID', 'Культура', 'Класс', 'Объём (т)', 'Цена (₽/т)', 'Сумма (₽)', 'Статус ФГИС', 'Регион', 'Продавец'],
    rows: [
      ['LOT-2401', 'Пшеница', '3 кл', 500, 18_200, 9_100_000, 'Подтверждён', 'Тамбовская обл.', 'ООО Агро-Юг'],
      ['LOT-2402', 'Ячмень', 'Кормовой', 300, 14_800, 4_440_000, 'Подтверждён', 'Воронежская обл.', 'ООО Зернотрейд'],
      ['LOT-2403', 'Кукуруза', 'Продов.', 800, 16_500, 13_200_000, 'На проверке', 'Курская обл.', 'ИП Фермеров К.С.'],
      ['LOT-2404', 'Подсолнечник', 'Масличный', 200, 47_000, 9_400_000, 'Подтверждён', 'Липецкая обл.', 'АО Маслопром'],
      ['LOT-2405', 'Соя', 'Продов.', 350, 38_000, 13_300_000, 'Отказ ФГИС', 'Тамбовская обл.', 'ООО Соевый Альянс'],
      ['LOT-2408', 'Пшеница', '4 кл', 600, 17_500, 10_500_000, 'Подтверждён', 'Воронежская обл.', 'ООО Элеватор-Плюс'],
    ],
  };
}

function buildDisputesData(): SheetData {
  return {
    name: 'Споры',
    columns: ['ID', 'Сделка', 'Тип', 'Сумма удержания (₽)', 'Статус', 'Истец', 'Ответчик', 'Открыт', 'Арбитр'],
    rows: [
      ['DK-2024-89', 'DL-9102', 'Расхождение по качеству', 320_000, 'На рассмотрении', 'Покупатель', 'Продавец', new Date('2024-03-28'), 'Иванов А.П.'],
      ['DK-2024-91', 'DL-9106', 'Недовес', 1_170_000, 'На рассмотрении', 'Покупатель', 'Продавец', new Date('2024-04-02'), 'Петров В.С.'],
      ['DK-2024-93', 'DL-9118', 'Протеин ниже нормы', 450_000, 'Эскалирован', 'Покупатель', 'Продавец', new Date('2024-04-10'), 'Сидоров Н.М.'],
    ],
  };
}

function buildPaymentsData(): SheetData {
  return {
    name: 'Выплаты',
    columns: ['ID', 'Сделка', 'Продавец', 'Сумма (₽)', 'Статус', 'Банк', 'Дата выплаты', 'Комментарий'],
    rows: [
      ['PAY-8801', 'DL-9109', 'ООО Элеватор-Плюс', 10_500_000, 'Выплачено', 'СберБизнес', new Date('2024-04-08'), ''],
      ['PAY-8802', 'DL-9103', 'ООО Зернотрейд', 2_800_000, 'Выплачено', 'РСХБ', new Date('2024-04-05'), ''],
      ['PAY-8803', 'DL-9102', 'ООО Агро-Юг', 3_880_000, 'Заблокировано', 'СберБизнес', null, 'Спор DK-2024-89'],
      ['PAY-8804', 'DL-9104', 'ИП Фермеров К.С.', 6_100_000, 'Ожидает подтверждения', 'РСХБ', null, 'Банк проверяет'],
    ],
  };
}

const BUILDERS: Record<ExcelExportDataset, () => SheetData> = {
  deals: buildDealsData,
  lots: buildLotsData,
  disputes: buildDisputesData,
  payments: buildPaymentsData,
};

async function generateExcel(dataset: ExcelExportDataset): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GrainFlow Platform v10';
  wb.created = new Date();

  const data = BUILDERS[dataset]();
  const ws = wb.addWorksheet(data.name);

  // Header row
  ws.addRow(data.columns);
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A7A5F' } };
  headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 24;

  // Data rows
  data.rows.forEach((row, idx) => {
    const excelRow = ws.addRow(row);
    excelRow.height = 20;
    if (idx % 2 === 1) {
      excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFB' } };
    }
    // Format money cells
    row.forEach((cell, ci) => {
      if (typeof cell === 'number') {
        ws.getRow(idx + 2).getCell(ci + 1).numFmt = '#,##0 "₽"';
      }
      if (cell instanceof Date) {
        ws.getRow(idx + 2).getCell(ci + 1).numFmt = 'dd.mm.yyyy';
      }
    });
  });

  // Auto-fit columns
  data.columns.forEach((_, ci) => {
    const col = ws.getColumn(ci + 1);
    let maxLen = data.columns[ci].length;
    data.rows.forEach((row) => {
      const v = row[ci];
      const len = v instanceof Date ? 10 : String(v ?? '').length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(Math.max(maxLen + 2, 10), 40);
  });

  // Border on all cells
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE4E6EA' } },
        left: { style: 'thin', color: { argb: 'FFE4E6EA' } },
        bottom: { style: 'thin', color: { argb: 'FFE4E6EA' } },
        right: { style: 'thin', color: { argb: 'FFE4E6EA' } },
      };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `grainflow-${dataset}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExcelExportButton({ dataset = 'deals', label }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      await generateExcel(dataset);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      aria-label={`Экспорт ${DATASET_LABEL[dataset]} в Excel`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
        padding: '0.4rem 0.875rem',
        borderRadius: 8,
        background: loading ? 'var(--p7-color-surface-muted)' : '#1D7A3A',
        color: '#fff',
        border: 'none',
        fontSize: 11,
        fontWeight: 700,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {loading ? '⏳' : '⬇'} {label ?? `Excel — ${DATASET_LABEL[dataset]}`}
    </button>
  );
}
