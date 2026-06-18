import { Update, Start, Command, On, Ctx, Hears } from 'nestjs-telegraf';
import { Context, Scenes } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelService } from '../excel/excel.service';
import { KeyboardService, KEYBOARD_BUTTONS } from './keyboard.service';

@Update()
export class BotUpdate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excel: ExcelService,
    private readonly keyboardService: KeyboardService,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const adminId = process.env.TG_ADMIN_ID;
    const isAdmin = adminId && ctx.from?.id.toString() === adminId.toString();

    const welcomeText =
      '👋 Привет! Я бот для сбора отчетов магазинов.\n\n' + 'Нажмите кнопку ниже, чтобы начать заполнение отчета:';

    await ctx.reply(welcomeText, this.keyboardService.getMainMenuKeyboard(!!isAdmin));
  }

  @Hears(KEYBOARD_BUTTONS.SEND_REPORT)
  async onStartReport(@Ctx() ctx: Scenes.SceneContext) {
    await ctx.scene.enter('report-wizard');
  }

  @Command('export')
  @Hears(KEYBOARD_BUTTONS.EXPORT_EXCEL)
  async onExport(@Ctx() ctx: Context) {
    const adminId = process.env.TG_ADMIN_ID;

    // Защита команды: проверяем Telegram ID отправителя
    if (!adminId || ctx.from?.id.toString() !== adminId.toString()) {
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
  async onMessage(@Ctx() ctx: Context) {
    if (ctx.message && 'text' in ctx.message) {
      const text = ctx.message.text;

      // Игнорируем сообщения, которые являются командами или кнопками
      if (text.startsWith('/') || this.keyboardService.getAllButtons().includes(text)) {
        console.log('====>', text);
        return;
      }

      await ctx.reply(
        `⚠️ Чтобы отправить отчет, пожалуйста, нажмите кнопку «${this.keyboardService.BUTTONS.SEND_REPORT}» ниже.`,
      );
    }
  }
}
