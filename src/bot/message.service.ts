import { Scenes } from 'telegraf';

export interface BaseWizardState {
  messagesToDelete?: number[];
}

export class MessageService {
  constructor() {}

  async deleteMessages(ctx: Scenes.WizardContext) {
    const state = ctx.wizard.state as BaseWizardState;
    const chatId = ctx.chat?.id;

    if (!chatId || !state.messagesToDelete?.length) {
      return;
    }

    for (const messageId of state.messagesToDelete) {
      try {
        await ctx.telegram.deleteMessage(chatId, messageId);
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }

    state.messagesToDelete = [];
  }

  addMessageToDelete(ctx: Scenes.WizardContext, messageId: number | undefined) {
    if (!messageId) {
      return;
    }

    const state = ctx.wizard.state as BaseWizardState;

    if (!state.messagesToDelete) {
      state.messagesToDelete = [];
    }

    if (!state.messagesToDelete.includes(messageId)) {
      state.messagesToDelete.push(messageId);
    }

    return messageId;
  }
}
