import { Module } from '@nestjs/common';
import { AppController } from './controllers/app.controller';
import { AppService } from './services/app.service';
import { AppConfig } from 'src/configs/app.config';
import { CommonModule } from '../common/common.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { AuthModule } from '../auth/auth.module';
import { VehicleModule } from '../vehicle/vehicle.module';
import { MaintenanceCardModule } from '../maintenance-card/maintenance-card.module';
import { ConfigModule as AppConfigModule } from '../config/config.module';

@Module({
  imports: [
    AppConfig.configModule,
    AppConfig.typeormModule,
    CommonModule,
    FirebaseModule,
    AuthModule,
    VehicleModule,
    MaintenanceCardModule,
    AppConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
