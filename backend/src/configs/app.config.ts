import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import DatabaseConfig from '../db/database.config';

export class AppConfig {
  private constructor() {}

  public static configModule = ConfigModule.forRoot({
    envFilePath: ['.env'],
    cache: false,
    isGlobal: true,
  });

  public static typeormModule = TypeOrmModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (configService: ConfigService) =>
      DatabaseConfig.getConfig(configService),
    dataSourceFactory: async (options) => {
      if (!options)
        throw new Error('Undefined option when initialize database');

      return await new DataSource(options).initialize();
    },
  });
}
