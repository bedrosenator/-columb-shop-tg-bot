import { Wizard, WizardStep, Ctx } from 'nestjs-telegraf';
import { ReportService } from './report.service';
import { KeyboardService } from './keyboard.service';
import { MessageService } from './message.service';
import type { AppContext } from './types/context.interface';

// Custom interface for wizard state to store report progress
interface ReportState {
  shopName?: string;
  cashbox?: number;
  terminalTurnover?: number;
  morningCash?: number;
  expenses?: number;
  salary?: number;
  photoFileId?: string;
  messagesToDelete?: number[];
}

@Wizard('report-wizard')
export class ReportWizard {
  constructor(
    private readonly reportService: ReportService,
    private readonly keyboardService: KeyboardService,
    private readonly messageService: MessageService,
  ) {}

  // Helper to register message deletion and check if user cancelled the wizard
  private async prepareStep(ctx: AppContext): Promise<boolean> {
    if (ctx.message) {
      this.messageService.addMessageToDelete(ctx, ctx.message.message_id);
    }
    return this.keyboardService.checkCancelClick(ctx);
  }

  // Helper method to generate main menu keyboard based on user role
  private getMainMenuKeyboard(isAdmin: boolean) {
    return this.keyboardService.getMainMenuKeyboard(isAdmin);
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
  async step1(@Ctx() ctx: AppContext) {
    try {
      // Add user's trigger message ("📝 Отправить отчет") if available
      this.messageService.addMessageToDelete(ctx, ctx?.message?.message_id);

      const shops = await this.reportService.getShops();
      const shopNames = shops.map((s) => s.name);

      const msg = await ctx.reply(
        '🏪 **Шаг 1/7**: Выберите магазин из списка или напишите название нового магазина:',
        this.keyboardService.getShopSelectionKeyboard(shopNames),
      );
      this.messageService.addMessageToDelete(ctx, msg.message_id);

      ctx.wizard.next();
    } catch (error) {
      console.error('Error in step 1:', error);
      await ctx.reply('Произошла ошибка. Попробуйте начать заново через команду /start.');
      await ctx.scene.leave();
    }
  }

  // STEP 2: Read Shop Name and ask for Cashbox
  @WizardStep(2)
  async step2(@Ctx() ctx: AppContext & { message: { text: string } }) {
    if (await this.prepareStep(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      const msg = await ctx.reply('⚠️ Пожалуйста, выберите магазин или введите текстовое название.');
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    const shopName = ctx.message.text.trim();
    if (!shopName) {
      const msg = await ctx.reply('⚠️ Имя магазина не может быть пустым. Введите название:');
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    // Save to state
    const state = ctx.wizard.state as ReportState;
    state.shopName = shopName;

    const msg = await ctx.reply(
      '💵 **Шаг 2/7**: Введите сумму в кассе (наличные) в грн:',
      this.keyboardService.getCancelKeyboard(),
    );
    this.messageService.addMessageToDelete(ctx, msg.message_id);

    ctx.wizard.next();
  }

  // STEP 3: Read Cashbox and ask for Terminal Turnover
  @WizardStep(3)
  async step3(@Ctx() ctx: AppContext & { message: { text: string } }) {
    if (await this.prepareStep(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      const msg = await ctx.reply('⚠️ Пожалуйста, введите число (сумму кассы):');
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    const value = this.parseNumberInput(ctx.message.text);
    if (value === null) {
      const msg = await ctx.reply(
        '⚠️ Сумма должна быть целым положительным числом. Пожалуйста, введите сумму кассы еще раз:',
      );
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    const state = ctx.wizard.state as ReportState;
    state.cashbox = value;

    const msg = await ctx.reply(
      '💳 **Шаг 3/7**: Введите безналичный оборот по терминалу в грн:',
      this.keyboardService.getCancelKeyboard(),
    );
    this.messageService.addMessageToDelete(ctx, msg.message_id);

    ctx.wizard.next();
  }

  // STEP 4: Read Terminal and ask for Morning Cash
  @WizardStep(4)
  async step4(@Ctx() ctx: AppContext & { message: { text: string } }) {
    if (await this.prepareStep(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      const msg = await ctx.reply('⚠️ Пожалуйста, введите число (оборот по терминалу):');
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    const value = this.parseNumberInput(ctx.message.text);
    if (value === null) {
      const msg = await ctx.reply(
        '⚠️ Сумма должна быть целым положительным числом. Пожалуйста, введите оборот по терминалу еще раз:',
      );
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    const state = ctx.wizard.state as ReportState;
    state.terminalTurnover = value;

    const msg = await ctx.reply(
      '🌅 **Шаг 4/7**: Введите сумму утреннего баланса кассы в грн:',
      this.keyboardService.getCancelKeyboard(),
    );
    this.messageService.addMessageToDelete(ctx, msg.message_id);

    ctx.wizard.next();
  }

  // STEP 5: Read Morning Cash and ask for Expenses
  @WizardStep(5)
  async step5(@Ctx() ctx: AppContext & { message: { text: string } }) {
    if (await this.prepareStep(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      const msg = await ctx.reply('⚠️ Пожалуйста, введите число (утренний баланс):');
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    const value = this.parseNumberInput(ctx.message.text);
    if (value === null) {
      const msg = await ctx.reply(
        '⚠️ Сумма должна быть целым положительным числом. Пожалуйста, введите утренний баланс еще раз:',
      );
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    const state = ctx.wizard.state as ReportState;
    state.morningCash = value;

    const msg = await ctx.reply(
      '📉 **Шаг 5/7**: Введите сумму расходов за день в грн:',
      this.keyboardService.getCancelKeyboard(),
    );
    this.messageService.addMessageToDelete(ctx, msg.message_id);

    ctx.wizard.next();
  }

  // STEP 6: Read Expenses and ask for Salary
  @WizardStep(6)
  async step6(@Ctx() ctx: AppContext & { message: { text: string } }) {
    if (await this.prepareStep(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      const msg = await ctx.reply('⚠️ Пожалуйста, введите число (расходы за день):');
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    const value = this.parseNumberInput(ctx.message.text);
    if (value === null) {
      const msg = await ctx.reply(
        '⚠️ Сумма должна быть целым положительным числом. Пожалуйста, введите сумму расходов еще раз:',
      );
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    const state = ctx.wizard.state as ReportState;
    state.expenses = value;

    const msg = await ctx.reply(
      '💰 **Шаг 6/7**: Введите выплаченную зарплату в грн:',
      this.keyboardService.getCancelKeyboard(),
    );
    this.messageService.addMessageToDelete(ctx, msg.message_id);

    ctx.wizard.next();
  }

  // STEP 7: Read Salary and ask for Photo
  @WizardStep(7)
  async step7(@Ctx() ctx: AppContext & { message: { text: string } }) {
    if (await this.prepareStep(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      const msg = await ctx.reply('⚠️ Пожалуйста, введите число (зарплата):');
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    const salary = this.parseNumberInput(ctx.message.text);
    if (salary === null) {
      const msg = await ctx.reply(
        '⚠️ Сумма должна быть целым положительным числом. Пожалуйста, введите выплаченную зарплату еще раз:',
      );
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    const state = ctx.wizard.state as ReportState;
    state.salary = salary;

    const msg = await ctx.reply(
      '📷 **Шаг 7/7**: Отправьте фотографию отчета:',
      this.keyboardService.getCancelKeyboard(),
    );
    this.messageService.addMessageToDelete(ctx, msg.message_id);

    ctx.wizard.next();
  }

  // STEP 8: Read Photo and Finalize Report
  @WizardStep(8)
  async step8(
    @Ctx()
    ctx: AppContext & {
      message: {
        text?: string;
        photo?: Array<{ file_id: string }>;
      };
    },
  ) {
    if (await this.prepareStep(ctx)) return;

    const photo = await this.reportService.attachPhoto(ctx, (msgId) =>
      this.messageService.addMessageToDelete(ctx, msgId),
    );

    if (!photo) return;

    const state = ctx.wizard.state as ReportState;
    state.photoFileId = photo;

    const { shopName, cashbox, terminalTurnover, morningCash, expenses, salary, photoFileId } = state;

    if (
      !shopName ||
      cashbox === undefined ||
      terminalTurnover === undefined ||
      morningCash === undefined ||
      expenses === undefined ||
      salary === undefined ||
      !photoFileId
    ) {
      await ctx.reply(
        '❌ Ошибка: Данные отчета неполные или сессия устарела. Начните заново.',
        this.getMainMenuKeyboard(ctx.isAdmin),
      );
      await ctx.scene.leave();
      return;
    }

    const savingMsg = await ctx.reply('💾 Сохраняю отчет и отправляю данные...');

    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || 'no_username';
      const firstName = ctx.from?.first_name || 'Без имени';
      const lastName = ctx.from?.last_name || '';

      if (!telegramId) return;

      const isUpdate = await this.reportService.saveAndForwardReport(ctx, {
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
      });

      await ctx.reply(
        isUpdate
          ? '✅ Отчет успешно обновлен, сохранен в базу и переслан руководству!'
          : '✅ Отчет успешно принят, сохранен в базу и переслан руководству!',
        this.getMainMenuKeyboard(ctx.isAdmin),
      );

      await ctx.scene.leave();
    } catch (error) {
      console.error('Error finalizing report:', error);

      await ctx.reply(
        '❌ Произошла ошибка при сохранении отчета. Попробуйте еще раз.',
        this.getMainMenuKeyboard(ctx.isAdmin),
      );
      await ctx.scene.leave();
    } finally {
      // Clean up wizard chat messages
      await this.messageService.deleteMessages(ctx);

      // Delete the "💾 Сохраняю отчет..." message
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, savingMsg.message_id);
      } catch {
        void 0;
      }
    }
  }
}
