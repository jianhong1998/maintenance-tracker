import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

import { ENTITY_MODELS } from './entity-model';

export default class DatabaseConfig {
  static getConfig(configService: ConfigService): DataSourceOptions {
    const migrationPathName = join(__dirname, '/migrations/*.{js,ts}');

    return {
      type: 'postgres',
      host: configService.get('DATABASE_HOST', 'localhost'),
      port: configService.get<number>('DATABASE_PORT', 5432),
      username: configService.get('DATABASE_USER', 'postgres'),
      password: configService.get('DATABASE_PASSWORD', 'postgres'),
      database: configService.get('DATABASE_DB', 'invoice_management_app_db'),
      entities: ENTITY_MODELS,
      migrations: [migrationPathName],
      migrationsRun: true,
      synchronize: false,
      ssl: false,
    };
  }
}
