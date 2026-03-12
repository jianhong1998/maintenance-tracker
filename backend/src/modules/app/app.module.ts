import { Module } from '@nestjs/common';
import { AppController } from './controllers/app.controller';
import { AppService } from './services/app.service';
import { AppConfig } from 'src/configs/app.config';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [AppConfig.configModule, AppConfig.typeormModule, CommonModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
