import { Update, Start, Command, On, Ctx, Hears } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelService } from '../excel/excel.service';

@Update()
export class BotUpdate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excel: ExcelService,
  ) {}

  @Start()
  @Hears('📝 Отправить новый отчет')
  async onStart(@Ctx() ctx: Context) {
    const adminId = process.env.TG_ADMIN_ID;
    const isAdmin = adminId && ctx.from?.id.toString() === adminId.toString();

    const welcomeText =
      '👋 Привет! Я бот для сбора отчетов магазинов.\n\n' +
      'Пришлите ежедневный отчет в следующем формате:\n\n' +
      'Магазин: Название\n' +
      'Касса: Число\n' +
      'Терминал: Число\n' +
      'Утро: Число\n' +
      'Расходы: Число\n' +
      'Зарплата: Число';

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
  async onMessage(@Ctx() ctx: Context & { message: { text: string } }) {
    const text = ctx.message.text;

    // Игнорируем сообщения, которые являются командами или кнопками
    if (
      text.startsWith('/') ||
      text === '📊 Экспорт в Excel' ||
      text === '📝 Отправить новый отчет'
    ) {
      return;
    }

    // Регулярные выражения для парсинга шаблона отчета
    const shopMatch = text.match(/Магазин:\s*(.+)/i);
    const cashboxMatch = text.match(/Касса:\s*(\d+)/i);
    const terminalMatch = text.match(/Терминал:\s*(\d+)/i);
    const morningCashMatch = text.match(/Утро:\s*(\d+)/i);
    const expensesMatch = text.match(/Расходы:\s*(\d+)/i);
    const salaryMatch = text.match(/Зарплата:\s*(\d+)/i);

    // Если сообщение не подходит под шаблон отчета
    if (
      !shopMatch ||
      !cashboxMatch ||
      !terminalMatch ||
      !morningCashMatch ||
      !expensesMatch ||
      !salaryMatch
    ) {
      await ctx.reply(
        '⚠️ Формат сообщения не распознан. Пожалуйста, отправьте отчет строго по шаблону:\n\n' +
          'Магазин: Название\n' +
          'Касса: Число\n' +
          'Терминал: Число\n' +
          'Утро: Число\n' +
          'Расходы: Число\n' +
          'Зарплата: Число',
      );
      return;
    }

    try {
      const shopName = shopMatch[1].trim();
      const cashbox = parseInt(cashboxMatch[1]);
      const terminalTurnover = parseInt(terminalMatch[1]);
      const morningCash = parseInt(morningCashMatch[1]);
      const expenses = parseInt(expensesMatch[1]);
      const salary = parseInt(salaryMatch[1]);

      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || 'no_username';
      const firstName = ctx.from?.first_name || 'Без имени';
      const lastName = ctx.from?.last_name || '';

      if (!telegramId) return;

      // 1. Создаем продавца, если его еще нет в БД, или обновляем его данные
      const seller = await this.prisma.seller.upsert({
        where: { telegramId: BigInt(telegramId) },
        update: { username, firstName, lastName },
        create: {
          telegramId: BigInt(telegramId),
          username,
          firstName,
          lastName,
        },
      });

      // 2. Находим или создаем магазин по названию
      let shop = await this.prisma.shop.findFirst({
        where: { name: { equals: shopName } },
      });

      if (!shop) {
        shop = await this.prisma.shop.create({
          data: { name: shopName },
        });
      }

      // 3. Создаем запись о расходах
      await this.prisma.shopExpenses.create({
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

      // 4. Отправляем красивую сводку в группу руководства
      const groupId = process.env.TG_GROUP_ID;
      if (groupId) {
        const forwardText =
          `📊 **Новый отчет о расходах**\n\n` +
          `🏪 **Магазин**: \`${shopName}\`\n` +
          `👤 **Продавец**: ${firstName} ${lastName} (@${username})\n\n` +
          `💵 **Касса (наличные)**: ${cashbox.toLocaleString('ru-RU')} грн.\n` +
          `💳 **Терминал (безнал)**: ${terminalTurnover.toLocaleString('ru-RU')} грн.\n` +
          `🌅 **Утренний баланс**: ${morningCash.toLocaleString('ru-RU')} грн.\n` +
          `📉 **Расходы**: ${expenses.toLocaleString('ru-RU')} грн.\n` +
          `💰 **Зарплата**: ${salary.toLocaleString('ru-RU')} грн.\n\n` +
          `📅 **Дата**: ${new Date().toLocaleDateString('ru-RU')}`;

        await ctx.telegram.sendMessage(groupId, forwardText, {
          parse_mode: 'Markdown',
        });
      }

      await ctx.reply(
        '✅ Отчет успешно принят, сохранен в базу и переслан руководству!',
      );
    } catch (error) {
      console.error('Ошибка обработки отчета:', error);
      await ctx.reply(
        '❌ Произошла ошибка при сохранении отчета. Попробуйте еще раз позже.',
      );
    }
  }
}
