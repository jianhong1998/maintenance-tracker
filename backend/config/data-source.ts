import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';

const options: DataSourceOptions & SeederOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: +(process.env.DATABASE_PORT || 5432),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_DB || 'project_db',
  synchronize: false,
  entities: ['dist/**/*.entity{.js,.ts}'],
  migrations: ['dist/**/migrations/**/*{.js,.ts}'],
  seeds: ['dist/**/seeders/**/*{.js,.ts}'],
  factories: ['dist/**/factories/**/*{.js,.ts}'],
  seedTracking: false,
  ssl: false,
};

export const dataSource = new DataSource(options);
