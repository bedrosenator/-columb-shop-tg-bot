import { KeyboardService } from './keyboard.service';
import type { AppContext, MediaMessageContext } from './types/context.interface';
import { MessageService } from './message.service';

export interface MediaUploadConfig {
  promptText: string;
  captionPrefix: string;
  successMessage: string;
  errorMessage: string;
  errorLogLabel: string;
  groupId: string;
}

export abstract class BaseMediaUploadWizard {
  constructor(
    protected readonly keyboardService: KeyboardService,
    protected readonly messageService: MessageService,
    protected readonly config: MediaUploadConfig,
  ) {}

  protected async stepOne(ctx: AppContext) {
    const message = await ctx.reply(this.config.promptText, this.keyboardService.getCancelKeyboard());
    this.messageService.addMessageToDelete(ctx, message.message_id);
    ctx.wizard.next();
  }

  protected async stepTwo(ctx: MediaMessageContext) {
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
      await ctx.telegram.sendPhoto(this.config.groupId, photo.file_id, {
        caption: `${this.config.captionPrefix}${ctx.message?.caption ? `\n ${ctx.message.caption}` : ''}`,
        parse_mode: 'Markdown',
      });

      // clear sent photos
      if (ctx.message && ctx.chat?.id) {
        await ctx.telegram.deleteMessage(ctx.chat?.id, ctx.message.message_id);
      }

      await ctx.scene.leave();
      await ctx.reply(this.config.successMessage, this.keyboardService.getMainMenuKeyboard(ctx.isAdmin));
    } catch (error) {
      console.error(`Ошибка отправки ${this.config.errorLogLabel}:`, error);
      await this.messageService.deleteMessages(ctx);
      await ctx.scene.leave();
      const errorMsg = await ctx.reply(this.config.errorMessage, this.keyboardService.getMainMenuKeyboard(ctx.isAdmin));
      this.messageService.addMessageToDelete(ctx, errorMsg.message_id);
    }
  }
}
