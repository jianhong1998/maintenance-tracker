import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

/**
 * Registers the 'maintenance' BullMQ queue and exports it for use in other modules.
 *
 * IMPORTANT: The importing context must call BullModule.forRoot() (or forRootAsync())
 * to configure the Redis connection before this module can function. Currently only
 * WorkerModule sets up BullModule.forRoot — any future module importing QueueModule
 * to enqueue jobs must also configure BullModule.forRoot.
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'maintenance',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
