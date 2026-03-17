import { Module } from '@nestjs/common';
import { AppController } from './controllers/app.controller';
import { AppService } from './services/app.service';
import { AppConfig } from 'src/configs/app.config';
import { CommonModule } from '../common/common.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { AuthModule } from '../auth/auth.module';
import { VehicleModule } from '../vehicle/vehicle.module';

@Module({
  imports: [
    AppConfig.configModule,
    AppConfig.typeormModule,
    CommonModule,
    FirebaseModule,
    AuthModule,
    VehicleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
