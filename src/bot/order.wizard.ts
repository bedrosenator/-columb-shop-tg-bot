import { Wizard, WizardStep, Ctx } from 'nestjs-telegraf';
import { KeyboardService } from './keyboard.service';
import type { AppContext, MediaMessageContext } from './types/context.interface';
import { MessageService } from './message.service';

@Wizard('order-wizard')
export class OrderWizard {
  constructor(
    private keyboardService: KeyboardService,
    private messageService: MessageService,
  ) {}

  @WizardStep(1)
  async step1(@Ctx() ctx: AppContext) {
    const message = await ctx.reply('Выберите фото для отправки:', this.keyboardService.getCancelKeyboard());
    this.messageService.addMessageToDelete(ctx, message.message_id);
    ctx.wizard.next();
  }

  @WizardStep(2)
  async step2(@Ctx() ctx: MediaMessageContext) {
    const photos = ctx.message?.photo;
    const photo = photos && photos.length > 0 ? photos[photos.length - 1] : undefined;
    const isCanceled = await this.keyboardService.checkCancelClick(ctx);

    if (isCanceled) {
      return;
    }

    if (!photo?.file_id) {
      const msg = await ctx.reply('⚠️ Пожалуйста, выберите фото.');
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    try {
      await ctx.telegram.sendPhoto(ctx.groupId, photo.file_id, {
        caption: `Фото заказа: ${ctx.message?.caption ? `\n ${ctx.message.caption}` : ''}`,
        parse_mode: 'Markdown',
      });

      // clear sent photos
      if (ctx.message && ctx.chat?.id) {
        await ctx.telegram.deleteMessage(ctx.chat?.id, ctx.message.message_id);
      }

      await ctx.scene.leave();
      await ctx.reply(`✅ Фото заказа отправлено!`, this.keyboardService.getMainMenuKeyboard(ctx.isAdmin));
    } catch (error) {
      console.error('Ошибка отправки фото заказа:', error);
      await this.messageService.deleteMessages(ctx);
      await ctx.scene.leave();
      const errorMsg = await ctx.reply(
        '❌ Произошла ошибка при отправке фото заказа. Попробуйте снова.',
        this.keyboardService.getMainMenuKeyboard(ctx.isAdmin),
      );
      this.messageService.addMessageToDelete(ctx, errorMsg.message_id);
    }
  }
}
