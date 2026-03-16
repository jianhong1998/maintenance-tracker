import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { UserEntity } from 'src/db/entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { AuthService } from './services/auth.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';

// FirebaseModule is @Global() (registered in AppModule via Plan 01),
// so FirebaseService is available here without importing FirebaseModule explicitly.
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [
    UserRepository,
    AuthService,
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
