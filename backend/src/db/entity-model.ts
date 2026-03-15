import { BackgroundJobEntity } from './entities/background-job.entity';
import { MaintenanceCardEntity } from './entities/maintenance-card.entity';
import { MaintenanceHistoryEntity } from './entities/maintenance-history.entity';
import { UserEntity } from './entities/user.entity';
import { VehicleEntity } from './entities/vehicle.entity';

export const ENTITY_MODELS = [
  UserEntity,
  VehicleEntity,
  MaintenanceCardEntity,
  MaintenanceHistoryEntity,
  BackgroundJobEntity,
];

export type ModelConstructorType = (typeof ENTITY_MODELS)[number];
