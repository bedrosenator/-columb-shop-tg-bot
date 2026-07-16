import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Context } from 'telegraf';
import { KeyboardService } from './keyboard.service';
import { AppContext } from './types/context.interface';
import { escapeHtml } from './utils';

export interface ReportData {
  shopName: string;
  cashbox: number;
  terminalTurnover: number;
  morningCash: number;
  expenses: number;
  salary: number;
  photoFileId: string;
  photoCaption?: string;
  telegramId: number;
  username: string;
  firstName: string;
  lastName: string;
}

export interface ReportStatus {
  isUpdate: boolean;
  isTgMessageSent: boolean;
}

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keyboardService: KeyboardService,
  ) {}

  async attachPhoto(
    ctx: Context & {
      message?: {
        text?: string;
        photo?: Array<{ file_id: string }>;
      };
    },
    onMessageSent?: (messageId: number) => void,
  ): Promise<string | undefined> {
    const message = ctx.message;

    if (message && message.photo && message.photo.length > 0) {
      // Get the largest photo size
      const photo = message.photo[message.photo.length - 1];
      return photo.file_id;
    }

    const msg = await ctx.reply(
      '⚠️ Пожалуйста, отправьте фотографию отчета:',
      this.keyboardService.getCancelKeyboard(),
    );

    if (onMessageSent) {
      onMessageSent(msg.message_id);
    }
    return;
  }

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

  async saveAndForwardReport(ctx: AppContext, data: ReportData): Promise<ReportStatus> {
    const reportStatus: ReportStatus = {
      isUpdate: false,
      isTgMessageSent: false,
    };

    const {
      shopName,
      cashbox,
      terminalTurnover,
      morningCash,
      expenses,
      salary,
      photoFileId,
      photoCaption,
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

    reportStatus.isUpdate = isUpdate;

    // 4. Send report summary to the group

    if (ctx.reportsGroupId) {
      const title = isUpdate ? `🔄 <b>Обновленный отчет о расходах</b>` : `📊 <b>Новый отчет о расходах</b>`;

      let forwardText =
        `${title}\n\n` +
        `🏪 <b>Магазин</b>: <code>${escapeHtml(shopName)}</code>\n` +
        `👤 <b>Продавец</b>: ${escapeHtml(firstName)} ${escapeHtml(lastName)} (@${escapeHtml(username)})\n\n` +
        `💵 <b>Касса (наличные)</b>: ${cashbox.toLocaleString('ru-RU')} грн.\n` +
        `💳 <b>Терминал (безнал)</b>: ${terminalTurnover.toLocaleString('ru-RU')} грн.\n` +
        `🌅 <b>Утренний баланс</b>: ${morningCash.toLocaleString('ru-RU')} грн.\n` +
        `📉 <b>Расходы</b>: ${expenses.toLocaleString('ru-RU')} грн.\n` +
        `💰 <b>Зарплата</b>: ${salary.toLocaleString('ru-RU')} грн.\n\n`;

      if (photoCaption) {
        forwardText += `📝 <b>Комментарий к фото</b>: ${escapeHtml(photoCaption)}\n\n`;
      }

      forwardText += `📅 <b>Дата</b>: ${new Date().toLocaleDateString('ru-RU')}`;

      try {
        if (photoFileId) {
          await ctx.telegram.sendPhoto(ctx.reportsGroupId, photoFileId, {
            caption: forwardText,
            parse_mode: 'HTML',
          });
        } else {
          await ctx.telegram.sendMessage(ctx.reportsGroupId, forwardText, {
            parse_mode: 'HTML',
          });
        }
        reportStatus.isTgMessageSent = true;
      } catch (error) {
        console.error('Error sending report:', error);
        reportStatus.isTgMessageSent = false;
      }
    }

    return reportStatus;
  }
}
