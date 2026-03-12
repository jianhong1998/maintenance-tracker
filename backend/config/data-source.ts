import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';

const options: DataSourceOptions & SeederOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: +(process.env.DATABASE_PORT || 5432),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_DB || 'invoice_management_app_db',
  synchronize: false,
  entities: ['dist/**/*.model{.js,.ts}'],
  migrations: ['dist/src/db/migrations/**/*{.js,.ts}'],
  seeds: ['dist/src/db/seeders/**/*{.js,.ts}'],
  factories: ['dist/src/db/factories/**/*{.js,.ts}'],
  seedTracking: false,
  ssl: false,
};

export const dataSource = new DataSource(options);
