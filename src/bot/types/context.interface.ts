import { Scenes } from 'telegraf';

// Расширяем стандартный контекст Telegraf нашими свойствами
export interface AppContext extends Scenes.WizardContext {
  isAdmin: boolean;
  groupId: string;
}

// Специализированный контекст для работы с медиа-сообщениями (фото/видео + подпись)
export interface MediaMessageContext extends AppContext {
  message: AppContext['message'] & {
    photo?: Array<{ file_id: string }>;
    caption?: string;
  };
}
