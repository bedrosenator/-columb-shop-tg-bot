import { Wizard, WizardStep, Ctx } from 'nestjs-telegraf';
import { Scenes, Markup } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';

// Custom interface for wizard state to store report progress
interface ReportState {
  shopName?: string;
  cashbox?: number;
  terminalTurnover?: number;
  morningCash?: number;
  expenses?: number;
  salary?: number;
}

@Wizard('report-wizard')
export class ReportWizard {
  constructor(private readonly prisma: PrismaService) {}

  // Helper method to generate main menu keyboard based on user role
  private getMainMenuKeyboard(ctx: Scenes.WizardContext) {
    const adminId = process.env.TG_ADMIN_ID;
    const isAdmin = adminId && ctx.from?.id.toString() === adminId.toString();

    if (isAdmin) {
      return Markup.keyboard([
        ['📝 Отправить новый отчет', '📊 Экспорт в Excel'],
      ]).resize();
    } else {
      return Markup.keyboard([['📝 Отправить новый отчет']]).resize();
    }
  }

  // Helper method to check if the user clicked cancel
  private async checkCancel(ctx: Scenes.WizardContext): Promise<boolean> {
    if (
      ctx.message &&
      'text' in ctx.message &&
      ctx.message.text === '❌ Отмена'
    ) {
      await ctx.reply(
        '❌ Заполнение отчета отменено.',
        this.getMainMenuKeyboard(ctx),
      );
      await ctx.scene.leave();
      return true;
    }
    return false;
  }

  // Helper to validate numeric input
  private parseNumberInput(text: string): number | null {
    const parsed = parseInt(text.trim());
    if (isNaN(parsed) || parsed < 0) {
      return null;
    }
    return parsed;
  }

  // --- WIZARD STEPS ---

  // STEP 1: Greet and ask for Shop Name
  @WizardStep(1)
  async step1(@Ctx() ctx: Scenes.WizardContext) {
    try {
      const shops = await this.prisma.shop.findMany({
        orderBy: { name: 'asc' },
      });

      const shopButtons = shops.map((s) => s.name);

      // Build keyboard: list of shops + Cancel button
      const keyboardRows: string[][] = [];
      // Group shops by 2 per row
      for (let i = 0; i < shopButtons.length; i += 2) {
        keyboardRows.push(shopButtons.slice(i, i + 2));
      }
      keyboardRows.push(['❌ Отмена']);

      await ctx.reply(
        '🏪 **Шаг 1/6**: Выберите магазин из списка или напишите название нового магазина:',
        Markup.keyboard(keyboardRows).resize(),
      );

      ctx.wizard.next();
    } catch (error) {
      console.error('Error in step 1:', error);
      await ctx.reply(
        'Произошла ошибка. Попробуйте начать заново через команду /start.',
      );
      await ctx.scene.leave();
    }
  }

  // STEP 2: Read Shop Name and ask for Cashbox
  @WizardStep(2)
  async step2(
    @Ctx() ctx: Scenes.WizardContext & { message: { text: string } },
  ) {
    if (await this.checkCancel(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply(
        '⚠️ Пожалуйста, выберите магазин или введите текстовое название.',
      );
      return;
    }

    const shopName = ctx.message.text.trim();
    if (!shopName) {
      await ctx.reply(
        '⚠️ Имя магазина не может быть пустым. Введите название:',
      );
      return;
    }

    // Save to state
    const state = ctx.wizard.state as ReportState;
    state.shopName = shopName;

    await ctx.reply(
      '💵 **Шаг 2/6**: Введите сумму в кассе (наличные) в грн:',
      Markup.keyboard([['❌ Отмена']]).resize(),
    );

    ctx.wizard.next();
  }

  // STEP 3: Read Cashbox and ask for Terminal Turnover
  @WizardStep(3)
  async step3(
    @Ctx() ctx: Scenes.WizardContext & { message: { text: string } },
  ) {
    if (await this.checkCancel(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('⚠️ Пожалуйста, введите число (сумму кассы):');
      return;
    }

    const value = this.parseNumberInput(ctx.message.text);
    if (value === null) {
      await ctx.reply(
        '⚠️ Сумма должна быть целым положительным числом. Пожалуйста, введите сумму кассы еще раз:',
      );
      return;
    }

    const state = ctx.wizard.state as ReportState;
    state.cashbox = value;

    await ctx.reply(
      '💳 **Шаг 3/6**: Введите безналичный оборот по терминалу в грн:',
      Markup.keyboard([['❌ Отмена']]).resize(),
    );

    ctx.wizard.next();
  }

  // STEP 4: Read Terminal and ask for Morning Cash
  @WizardStep(4)
  async step4(
    @Ctx() ctx: Scenes.WizardContext & { message: { text: string } },
  ) {
    if (await this.checkCancel(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('⚠️ Пожалуйста, введите число (оборот по терминалу):');
      return;
    }

    const value = this.parseNumberInput(ctx.message.text);
    if (value === null) {
      await ctx.reply(
        '⚠️ Сумма должна быть целым положительным числом. Пожалуйста, введите оборот по терминалу еще раз:',
      );
      return;
    }

    const state = ctx.wizard.state as ReportState;
    state.terminalTurnover = value;

    await ctx.reply(
      '🌅 **Шаг 4/6**: Введите сумму утреннего баланса кассы в грн:',
      Markup.keyboard([['❌ Отмена']]).resize(),
    );

    ctx.wizard.next();
  }

  // STEP 5: Read Morning Cash and ask for Expenses
  @WizardStep(5)
  async step5(
    @Ctx() ctx: Scenes.WizardContext & { message: { text: string } },
  ) {
    if (await this.checkCancel(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('⚠️ Пожалуйста, введите число (утренний баланс):');
      return;
    }

    const value = this.parseNumberInput(ctx.message.text);
    if (value === null) {
      await ctx.reply(
        '⚠️ Сумма должна быть целым положительным числом. Пожалуйста, введите утренний баланс еще раз:',
      );
      return;
    }

    const state = ctx.wizard.state as ReportState;
    state.morningCash = value;

    await ctx.reply(
      '📉 **Шаг 5/6**: Введите сумму расходов за день в грн:',
      Markup.keyboard([['❌ Отмена']]).resize(),
    );

    ctx.wizard.next();
  }

  // STEP 6: Read Expenses and ask for Salary
  @WizardStep(6)
  async step6(
    @Ctx() ctx: Scenes.WizardContext & { message: { text: string } },
  ) {
    if (await this.checkCancel(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('⚠️ Пожалуйста, введите число (расходы за день):');
      return;
    }

    const value = this.parseNumberInput(ctx.message.text);
    if (value === null) {
      await ctx.reply(
        '⚠️ Сумма должна быть целым положительным числом. Пожалуйста, введите сумму расходов еще раз:',
      );
      return;
    }

    const state = ctx.wizard.state as ReportState;
    state.expenses = value;

    await ctx.reply(
      '💰 **Шаг 6/6**: Введите выплаченную зарплату в грн:',
      Markup.keyboard([['❌ Отмена']]).resize(),
    );

    ctx.wizard.next();
  }

  // STEP 7: Read Salary and Finalize Report
  @WizardStep(7)
  async step7(
    @Ctx() ctx: Scenes.WizardContext & { message: { text: string } },
  ) {
    if (await this.checkCancel(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('⚠️ Пожалуйста, введите число (зарплата):');
      return;
    }

    const salary = this.parseNumberInput(ctx.message.text);
    if (salary === null) {
      await ctx.reply(
        '⚠️ Сумма должна быть целым положительным числом. Пожалуйста, введите выплаченную зарплату еще раз:',
      );
      return;
    }

    const state = ctx.wizard.state as ReportState;
    state.salary = salary;

    await ctx.reply('💾 Сохраняю отчет и отправляю данные...');

    try {
      const { shopName, cashbox, terminalTurnover, morningCash, expenses } =
        state;

      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || 'no_username';
      const firstName = ctx.from?.first_name || 'Без имени';
      const lastName = ctx.from?.last_name || '';

      if (!telegramId) return;

      // 1. Find or create Seller
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

      // 2. Find or create Shop
      let shop = await this.prisma.shop.findFirst({
        where: { name: { equals: shopName } },
      });

      if (!shop) {
        shop = await this.prisma.shop.create({
          data: { name: shopName! },
        });
      }

      // 3. Create Expenses record
      await this.prisma.shopExpenses.create({
        data: {
          cashbox: cashbox!,
          terminalTurnover: terminalTurnover!,
          morningCash: morningCash!,
          expenses: expenses!,
          salary: salary,
          sellerId: seller.id,
          shopId: shop.id,
          reportDate: new Date(),
        },
      });

      // 4. Send report summary to the group
      const groupId = process.env.TG_GROUP_ID;
      if (groupId) {
        const forwardText =
          `📊 **Новый отчет о расходах**\n\n` +
          `🏪 **Магазин**: \`${shopName}\`\n` +
          `👤 **Продавец**: ${firstName} ${lastName} (@${username})\n\n` +
          `💵 **Касса (наличные)**: ${cashbox!.toLocaleString('ru-RU')} грн.\n` +
          `💳 **Терминал (безнал)**: ${terminalTurnover!.toLocaleString('ru-RU')} грн.\n` +
          `🌅 **Утренний баланс**: ${morningCash!.toLocaleString('ru-RU')} грн.\n` +
          `📉 **Расходы**: ${expenses!.toLocaleString('ru-RU')} грн.\n` +
          `💰 **Зарплата**: ${salary.toLocaleString('ru-RU')} грн.\n\n` +
          `📅 **Дата**: ${new Date().toLocaleDateString('ru-RU')}`;

        await ctx.telegram.sendMessage(groupId, forwardText, {
          parse_mode: 'Markdown',
        });
      }

      await ctx.reply(
        '✅ Отчет успешно принят, сохранен в базу и переслан руководству!',
        this.getMainMenuKeyboard(ctx),
      );

      await ctx.scene.leave();
    } catch (error) {
      console.error('Error finalizing report:', error);
      await ctx.reply(
        '❌ Произошла ошибка при сохранении отчета. Попробуйте еще раз.',
        this.getMainMenuKeyboard(ctx),
      );
      await ctx.scene.leave();
    }
  }
}
