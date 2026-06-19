import { Scenes } from 'telegraf';

// Расширяем стандартный контекст Telegraf нашими свойствами
export interface AppContext extends Scenes.WizardContext {
  isAdmin: boolean;
  groupId: string;
}
