import { Update, Start, Command, On, Ctx, Hears } from 'nestjs-telegraf';
import { Context, Markup, Scenes } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelService } from '../excel/excel.service';

@Update()
export class BotUpdate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excel: ExcelService,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const adminId = process.env.TG_ADMIN_ID;
    const isAdmin = adminId && ctx.from?.id.toString() === adminId.toString();

    const welcomeText =
      '👋 Привет! Я бот для сбора отчетов магазинов.\n\n' +
      'Нажмите кнопку ниже, чтобы начать заполнение отчета:';

    if (isAdmin) {
      await ctx.reply(
        welcomeText,
        Markup.keyboard([
          ['📝 Отправить новый отчет', '📊 Экспорт в Excel'],
        ]).resize(),
      );
    } else {
      await ctx.reply(
        welcomeText,
        Markup.keyboard([['📝 Отправить новый отчет']]).resize(),
      );
    }
  }

  @Hears('📝 Отправить новый отчет')
  async onStartReport(@Ctx() ctx: Scenes.SceneContext) {
    await ctx.scene.enter('report-wizard');
  }

  @Command('export')
  @Hears('📊 Экспорт в Excel')
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
      if (
        text.startsWith('/') ||
        text === '📊 Экспорт в Excel' ||
        text === '📝 Отправить новый отчет'
      ) {
        return;
      }

      await ctx.reply(
        '⚠️ Чтобы отправить отчет, пожалуйста, нажмите кнопку «📝 Отправить новый отчет» ниже.',
      );
    }
  }
}
