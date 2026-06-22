import { Update, Start, Command, On, Ctx, Hears } from 'nestjs-telegraf';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelService } from '../excel/excel.service';
import { KeyboardService, KEYBOARD_BUTTONS } from './keyboard.service';
import type { AppContext } from './types/context.interface';

@Update()
export class BotUpdate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excel: ExcelService,
    private readonly keyboardService: KeyboardService,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: AppContext) {
    const welcomeText =
      '👋 Привет! Я бот для сбора отчетов магазинов.\n\n' + 'Нажмите кнопку ниже, для отправки отчётов:';

    await ctx.reply(welcomeText, this.keyboardService.getMainMenuKeyboard(ctx.isAdmin));
  }

  @Hears(KEYBOARD_BUTTONS.SEND_REPORT)
  async onStartReport(@Ctx() ctx: AppContext) {
    await ctx.scene.enter('report-wizard');
  }

  @Hears(KEYBOARD_BUTTONS.ORDER)
  async onOrder(@Ctx() ctx: AppContext) {
    await ctx.scene.enter('order-wizard');
  }

  @Hears(KEYBOARD_BUTTONS.BILLS)
  async onBills(@Ctx() ctx: AppContext) {
    await ctx.scene.enter('bills-wizard');
  }

  @Hears(KEYBOARD_BUTTONS.SHOP_WINDOW)
  async onShopWindow(@Ctx() ctx: AppContext) {
    await ctx.scene.enter('shop-window-wizard');
  }

  @Command('export')
  @Hears(KEYBOARD_BUTTONS.EXPORT_EXCEL)
  async onExport(@Ctx() ctx: AppContext) {
    // Защита команды: проверяем Telegram ID отправителя
    if (!ctx.isAdmin) {
      await ctx.reply('🔒 У вас нет прав для выполнения этой команды.');
      return;
    }

    await ctx.reply('⏳ Генерирую отчет Excel...');

    try {
      // Запрашиваем из базы все записи расходов, включая данные о магазине и продавце
      const expenses = await this.prisma.shopExpenses.findMany({
        include: {
          seller: true,
          shop: true,
        },
        orderBy: {
          reportDate: 'desc',
        },
      });

      if (expenses.length === 0) {
        await ctx.reply('База данных пуста, нечего экспортировать.');
        return;
      }

      // Генерируем буфер файла
      const buffer = await this.excel.generateExpensesReport(expenses);

      // Отправляем файл пользователю
      await ctx.replyWithDocument(
        {
          source: buffer,
          filename: `expenses_report_${new Date().toISOString().split('T')[0]}.xlsx`,
        },
        { caption: '📊 Выгрузка отчетов расходов магазинов' },
      );
    } catch (error) {
      console.error('Ошибка экспорта в Excel:', error);
      await ctx.reply('❌ Произошла ошибка при генерации Excel-файла.');
    }
  }

  @On('text')
  async onMessage(@Ctx() ctx: AppContext) {
    if (ctx.message && 'text' in ctx.message) {
      const text = ctx.message.text;

      // Игнорируем сообщения, которые являются командами или кнопками
      if (text.startsWith('/') || this.keyboardService.getAllButtons().includes(text)) {
        return;
      }

      await ctx.reply(
        `⚠️ Чтобы отправить отчет, пожалуйста, нажмите кнопку «${this.keyboardService.BUTTONS.SEND_REPORT}» ниже.`,
      );
    }
  }
}
