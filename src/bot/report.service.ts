import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Scenes } from 'telegraf';

export interface ReportData {
  shopName: string;
  cashbox: number;
  terminalTurnover: number;
  morningCash: number;
  expenses: number;
  salary: number;
  photoFileId: string;
  telegramId: number;
  username: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  // Fetch all shops sorted by name
  async getShops() {
    return this.prisma.shop.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Calculate start/end of day in Europe/Kyiv timezone
  getKyivDateBounds(): { todayStart: Date; todayEnd: Date } {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(now);

    const year = parseInt(parts.find((p) => p.type === 'year')!.value);
    const month = parseInt(parts.find((p) => p.type === 'month')!.value) - 1;
    const day = parseInt(parts.find((p) => p.type === 'day')!.value);
    const hour = parseInt(parts.find((p) => p.type === 'hour')!.value);
    const minute = parseInt(parts.find((p) => p.type === 'minute')!.value);
    const second = parseInt(parts.find((p) => p.type === 'second')!.value);

    const kyivLocalTime = Date.UTC(year, month, day, hour, minute, second);
    const offsetMs = kyivLocalTime - now.getTime();

    const localStartUtcTimestamp = Date.UTC(year, month, day, 0, 0, 0, 0);
    const localEndUtcTimestamp = Date.UTC(year, month, day, 23, 59, 59, 999);

    const todayStart = new Date(localStartUtcTimestamp - offsetMs);
    const todayEnd = new Date(localEndUtcTimestamp - offsetMs);

    return { todayStart, todayEnd };
  }

  async saveAndForwardReport(ctx: Scenes.WizardContext, data: ReportData): Promise<boolean> {
    const {
      shopName,
      cashbox,
      terminalTurnover,
      morningCash,
      expenses,
      salary,
      photoFileId,
      telegramId,
      username,
      firstName,
      lastName,
    } = data;

    // Save to DB in transaction
    const { isUpdate } = await this.prisma.$transaction(async (tx) => {
      // 1. Find or create Seller
      const seller = await tx.seller.upsert({
        where: { telegramId: BigInt(telegramId) },
        update: { username, firstName, lastName },
        create: {
          telegramId: BigInt(telegramId),
          username,
          firstName,
          lastName,
        },
      });

      // 2. Find or create Shop
      let shop = await tx.shop.findFirst({
        where: { name: { equals: shopName } },
      });

      if (!shop) {
        shop = await tx.shop.create({
          data: { name: shopName },
        });
      }

      // 3. Create or update Expenses record
      const { todayStart, todayEnd } = this.getKyivDateBounds();

      const existingReport = await tx.shopExpenses.findFirst({
        where: {
          shopId: shop.id,
          reportDate: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      });

      let isUpdateRecord = false;

      if (existingReport) {
        isUpdateRecord = true;
        await tx.shopExpenses.update({
          where: { id: existingReport.id },
          data: {
            cashbox,
            terminalTurnover,
            morningCash,
            expenses,
            salary,
            sellerId: seller.id,
            reportDate: new Date(),
          },
        });
      } else {
        await tx.shopExpenses.create({
          data: {
            cashbox,
            terminalTurnover,
            morningCash,
            expenses,
            salary,
            sellerId: seller.id,
            shopId: shop.id,
            reportDate: new Date(),
          },
        });
      }

      return { isUpdate: isUpdateRecord };
    });

    // 4. Send report summary to the group
    const groupId = process.env.TG_GROUP_ID;
    if (groupId) {
      const title = isUpdate ? `🔄 **Обновленный отчет о расходах**` : `📊 **Новый отчет о расходах**`;

      const forwardText =
        `${title}\n\n` +
        `🏪 **Магазин**: \`${shopName}\`\n` +
        `👤 **Продавец**: ${firstName} ${lastName} (@${username})\n\n` +
        `💵 **Касса (наличные)**: ${cashbox.toLocaleString('ru-RU')} грн.\n` +
        `💳 **Терминал (безнал)**: ${terminalTurnover.toLocaleString('ru-RU')} грн.\n` +
        `🌅 **Утренний баланс**: ${morningCash.toLocaleString('ru-RU')} грн.\n` +
        `📉 **Расходы**: ${expenses.toLocaleString('ru-RU')} грн.\n` +
        `💰 **Зарплата**: ${salary.toLocaleString('ru-RU')} грн.\n\n` +
        `📅 **Дата**: ${new Date().toLocaleDateString('ru-RU')}`;

      if (photoFileId) {
        await ctx.telegram.sendPhoto(groupId, photoFileId, {
          caption: forwardText,
          parse_mode: 'Markdown',
        });
      } else {
        await ctx.telegram.sendMessage(groupId, forwardText, {
          parse_mode: 'Markdown',
        });
      }
    }

    return isUpdate;
  }
}
