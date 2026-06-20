import { Wizard, WizardStep, Ctx } from 'nestjs-telegraf';
import { KeyboardService } from './keyboard.service';
import type { AppContext, MediaMessageContext } from './types/context.interface';
import { MessageService } from './message.service';
import { BaseMediaUploadWizard } from './base-media-upload.wizard';

@Wizard('order-wizard')
export class OrderWizard extends BaseMediaUploadWizard {
  constructor(keyboardService: KeyboardService, messageService: MessageService) {
    super(keyboardService, messageService, {
      promptText: 'Выберите фото заказа для отправки:',
      captionPrefix: 'Фото заказа: ',
      successMessage: '✅ Фото заказа отправлено!',
      errorMessage: '❌ Произошла ошибка при отправке фото заказа. Попробуйте снова.',
      errorLogLabel: 'фото заказа',
      groupId: process.env.TG_GROUP_ID_ORDERS!,
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
