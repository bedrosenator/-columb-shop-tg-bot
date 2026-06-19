import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ExcelModule } from './excel/excel.module';
import { BotUpdate } from './bot/bot.update';
import { ReportWizard } from './bot/report.wizard';
import { ReportService } from './bot/report.service';
import { KeyboardService } from './bot/keyboard.service';
import { OrderWizard } from './bot/order.wizard';
import { botConfigMiddleware } from './bot/app.middleware';

import { session } from 'telegraf';
import { MessageService } from './bot/message.service';

@Module({
  imports: [
    PrismaModule,
    ExcelModule,

    TelegrafModule.forRoot({
      token: process.env.TG_BOT_TOKEN!,
      middlewares: [session(), botConfigMiddleware],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, BotUpdate, ReportWizard, ReportService, KeyboardService, OrderWizard, MessageService],
})
export class AppModule {}
