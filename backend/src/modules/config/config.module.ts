import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';

// ConfigService is provided globally via AppConfig.configModule (isGlobal: true)
// in src/configs/app.config.ts — no explicit import needed here.
@Module({
  controllers: [ConfigController],
})
export class ConfigModule {}
