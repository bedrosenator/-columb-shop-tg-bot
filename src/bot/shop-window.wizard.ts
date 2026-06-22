import { Wizard, WizardStep, Ctx } from 'nestjs-telegraf';
import { KeyboardService } from './keyboard.service';
import type { AppContext, MediaMessageContext } from './types/context.interface';
import { MessageService } from './message.service';
import { BaseMediaUploadWizard } from './base-media-upload.wizard';

@Wizard('shop-window-wizard')
export class ShopWindowWizard extends BaseMediaUploadWizard {
  constructor(keyboardService: KeyboardService, messageService: MessageService) {
    super(keyboardService, messageService, {
      promptText: 'Выберите фото витрины для отправки:',
      captionPrefix: 'Фото витрины: ',
      successMessage: '✅ Фото витрины отправлено!',
      errorMessage: '❌ Произошла ошибка при отправке фото витрины. Попробуйте снова.',
      errorLogLabel: 'фото витрины',
      groupId: process.env.TG_GROUP_ID_SHOP_WINDOW!,
    });
  }

  @WizardStep(1)
  async step1(@Ctx() ctx: AppContext) {
    await this.stepOne(ctx);
  }

  @WizardStep(2)
  async step2(@Ctx() ctx: MediaMessageContext) {
    await this.stepTwo(ctx);
  }
}
