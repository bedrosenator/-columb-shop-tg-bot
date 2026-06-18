import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ShopExpenses, Seller, Shop } from '../../generated/prisma/client';

export type ExpenseWithRelation = ShopExpenses & {
  seller?: Seller | null;
  shop?: Shop | null;
};

@Injectable()
export class ExcelService {
  async generateExpensesReport(expenses: ExpenseWithRelation[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Расходы магазинов');

    // Заголовки колонок отчета
    worksheet.columns = [
      { header: 'Дата отчета', key: 'reportDate', width: 15 },
      { header: 'Магазин', key: 'shopName', width: 20 },
      { header: 'Продавец', key: 'sellerName', width: 25 },
      { header: 'Касса (наличные)', key: 'cashbox', width: 18 },
      { header: 'Терминал (оборот)', key: 'terminalTurnover', width: 20 },
      { header: 'Утренний баланс', key: 'morningCash', width: 18 },
      { header: 'Расходы за день', key: 'expenses', width: 18 },
      { header: 'Зарплата', key: 'salary', width: 15 },
      { header: 'Итого выручка', key: 'revenue', width: 18 },
    ];

    // Стилизуем заголовок (жирный шрифт, белый текст, синий фон)
    const headerRow = worksheet.getRow(1);
    headerRow.font = {
      name: 'Arial',
      family: 4,
      size: 11,
      bold: true,
      color: { argb: 'FFFFFF' },
    };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '366092' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Заполняем данными
    expenses.forEach((item) => {
      const formattedDate = item.reportDate ? new Date(item.reportDate).toLocaleDateString('ru-RU') : '';
      const sellerName = item.seller
        ? `${item.seller.firstName} ${item.seller.lastName || ''} (@${item.seller.username})`
        : 'Неизвестно';
      const shopName = item.shop ? item.shop.name : 'Неизвестно';

      // Рассчитываем итоговую выручку (например: Наличные + Безнал)
      const revenue = (item.cashbox || 0) + (item.terminalTurnover || 0);

      worksheet.addRow({
        reportDate: formattedDate,
        shopName: shopName,
        sellerName: sellerName,
        cashbox: item.cashbox || 0,
        terminalTurnover: item.terminalTurnover || 0,
        morningCash: item.morningCash || 0,
        expenses: item.expenses || 0,
        salary: item.salary || 0,
        revenue: revenue,
      });
    });

    // Форматируем ячейки с суммами (делаем разделение разрядов тысяч)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.height = 20;
        row.alignment = { vertical: 'middle' };
        for (let col = 4; col <= 9; col++) {
          const cell = row.getCell(col);
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      }
    });

    // Закрепляем первую строку (чтобы шапка не уезжала при скролле)
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
