import { Global, Module } from '@nestjs/common';
import { LoggerUtil } from './utils/logger.util';
import { EnvironmentVariableUtil } from './utils/environment-variable.util';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [LoggerUtil, EnvironmentVariableUtil],
  exports: [LoggerUtil, EnvironmentVariableUtil],
})
export class CommonModule {}
