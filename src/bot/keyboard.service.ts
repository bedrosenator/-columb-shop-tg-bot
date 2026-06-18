import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';

export const KEYBOARD_BUTTONS = {
  SEND_REPORT: '📝 Отправить отчет',
  EXPORT_EXCEL: '📊 Экспорт в Excel',
  ORDER: '📦 Заказ',
  BILLS: '🧾 Накладные',
  CANCEL: '❌ Отмена',
};

@Injectable()
export class KeyboardService {
  // Constants for button labels
  public readonly BUTTONS = KEYBOARD_BUTTONS;

  /**
   * Returns a list of all defined button texts for message validation/filtering
   */
  public getAllButtons(): string[] {
    return Object.values(this.BUTTONS);
  }

  /**
   * Generates the main menu keyboard depending on whether the user is an admin
   */
  public getMainMenuKeyboard(isAdmin: boolean): Markup.Markup<any> {
    const rows: string[][] = [
      [this.BUTTONS.SEND_REPORT, this.BUTTONS.EXPORT_EXCEL],
      [this.BUTTONS.ORDER, this.BUTTONS.BILLS],
    ];

    if (!isAdmin) {
      rows[0].pop();
    }

    return Markup.keyboard(rows).resize();
  }

  /**
   * Generates the cancel keyboard for wizard steps
   */
  public getCancelKeyboard(): Markup.Markup<any> {
    return Markup.keyboard([this.BUTTONS.CANCEL]).resize();
  }

  /**
   * Generates the shop selection keyboard containing shop name buttons and a Cancel button
   */
  public getShopSelectionKeyboard(shopNames: string[]): Markup.Markup<any> {
    const keyboardRows: string[][] = [];

    // Group shops by 2 per row
    for (let i = 0; i < shopNames.length; i += 2) {
      keyboardRows.push(shopNames.slice(i, i + 2));
    }

    keyboardRows.push([this.BUTTONS.CANCEL]);

    return Markup.keyboard(keyboardRows).resize();
  }
}
