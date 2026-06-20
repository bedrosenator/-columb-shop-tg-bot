import { Wizard, WizardStep, Ctx } from 'nestjs-telegraf';
import { KeyboardService } from './keyboard.service';
import type { AppContext, MediaMessageContext } from './types/context.interface';
import { MessageService } from './message.service';
import { BaseMediaUploadWizard } from './base-media-upload.wizard';

@Wizard('bills-wizard')
export class BillsWizard extends BaseMediaUploadWizard {
  constructor(keyboardService: KeyboardService, messageService: MessageService) {
    super(keyboardService, messageService, {
      promptText: 'Выберите фото накладной для отправки:',
      captionPrefix: 'Фото накладной: ',
      successMessage: '✅ Фото накладной отправлено!',
      errorMessage: '❌ Произошла ошибка при отправке фото накладной. Попробуйте снова.',
      errorLogLabel: 'фото накладной',
      groupId: process.env.TG_GROUP_ID_BILLS!,
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
