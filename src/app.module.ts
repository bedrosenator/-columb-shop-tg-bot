import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ExcelModule } from './excel/excel.module';
import { BotUpdate } from './bot/bot.update';

@Module({
  imports: [
    PrismaModule,
    ExcelModule,

    TelegrafModule.forRoot({
      token: process.env.TG_BOT_TOKEN!,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, BotUpdate],
})
export class AppModule { }

