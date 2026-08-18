import { KeyboardService } from './keyboard.service';
import type { AppContext, MediaMessageContext } from './types/context.interface';
import { MessageService } from './message.service';
import { escapeHtml } from './utils';

export interface MediaUploadConfig {
  promptText: string;
  captionPrefix: string;
  successMessage: string;
  errorMessage: string;
  errorLogLabel: string;
  groupId: string;
}

interface WizardState {
  completed?: boolean;
  processing?: boolean;
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
    const isCanceled = await this.keyboardService.checkCancelClick(ctx);
    if (isCanceled) {
      return;
    }

    const photos = ctx.message?.photo;
    const photo = photos && photos.length > 0 ? photos[photos.length - 1] : undefined;

    if (!photo?.file_id) {
      const msg = await ctx.reply('⚠️ Пожалуйста, выберите фото.');
      this.messageService.addMessageToDelete(ctx, msg.message_id);
      return;
    }

    const state = ctx.wizard.state as WizardState;

    // Prevent duplicate responses when an album (multiple photos) is sent
    if (state.completed) {
      return;
    }

    const isFirstInAlbum = !state.processing;
    if (isFirstInAlbum) {
      state.processing = true;
    }

    const targetGroupId = this.config.groupId;

    try {
      const escapedCaption = ctx.message?.caption ? `\n${escapeHtml(ctx.message.caption)}` : '';
      await ctx.telegram.sendPhoto(targetGroupId, photo.file_id, {
        caption: `${escapeHtml(this.config.captionPrefix)}${escapedCaption}`,
        parse_mode: 'HTML',
      });

      if (ctx.message && ctx.chat?.id) {
        await ctx.telegram.deleteMessage(ctx.chat?.id, ctx.message.message_id).catch(() => {});
      }

      if (isFirstInAlbum) {
        state.completed = true;
        await ctx.scene.leave();
        await this.messageService.deleteMessages(ctx);
        await ctx.reply(this.config.successMessage, this.keyboardService.getMainMenuKeyboard(ctx.isAdmin));
      }
    } catch (error: any) {
      console.error(`Ошибка отправки ${this.config.errorLogLabel}:`, error);

      const migrateToChatId = error?.parameters?.migrate_to_chat_id;
      if (migrateToChatId) {
        console.log(`[Auto-Migrate] Retrying ${this.config.errorLogLabel} with supergroup ID: ${migrateToChatId}`);
        try {
          const escapedCaption = ctx.message?.caption ? `\n${escapeHtml(ctx.message.caption)}` : '';
          await ctx.telegram.sendPhoto(migrateToChatId, photo.file_id, {
            caption: `${escapeHtml(this.config.captionPrefix)}${escapedCaption}`,
            parse_mode: 'HTML',
          });

          if (ctx.message && ctx.chat?.id) {
            await ctx.telegram.deleteMessage(ctx.chat?.id, ctx.message.message_id).catch(() => {});
          }

          if (isFirstInAlbum) {
            state.completed = true;
            await ctx.scene.leave();
            await this.messageService.deleteMessages(ctx);
            await ctx.reply(this.config.successMessage, this.keyboardService.getMainMenuKeyboard(ctx.isAdmin));
          }
          return;
        } catch (retryError) {
          console.error(`Error after auto-migrate retry for ${this.config.errorLogLabel}:`, retryError);
        }
      }

      if (isFirstInAlbum) {
        state.completed = true;
        await this.messageService.deleteMessages(ctx);
        await ctx.scene.leave();
        const errorMsg = await ctx.reply(this.config.errorMessage, this.keyboardService.getMainMenuKeyboard(ctx.isAdmin));
        this.messageService.addMessageToDelete(ctx, errorMsg.message_id);
      }
    }
  }
}
