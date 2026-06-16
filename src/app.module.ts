import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ExcelModule } from './excel/excel.module';
import { BotUpdate } from './bot/bot.update';
import { ReportWizard } from './bot/report.wizard';

import { session } from 'telegraf';

@Module({
  imports: [
    PrismaModule,
    ExcelModule,

    TelegrafModule.forRoot({
      token: process.env.TG_BOT_TOKEN!,
      middlewares: [session()],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, BotUpdate, ReportWizard],
})
export class AppModule {}
