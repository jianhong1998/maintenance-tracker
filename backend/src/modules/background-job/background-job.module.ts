import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackgroundJobEntity } from 'src/db/entities/background-job.entity';
import { BackgroundJobRepository } from './repositories/background-job.repository';

@Module({
  imports: [TypeOrmModule.forFeature([BackgroundJobEntity])],
  providers: [BackgroundJobRepository],
  exports: [BackgroundJobRepository],
})
export class BackgroundJobModule {}
