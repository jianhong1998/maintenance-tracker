import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UserEntity } from 'src/db/entities/user.entity';
import { BaseDBUtil } from 'src/modules/common/base-classes/base-db-util';

export type CreateUserData = {
  email: string;
  firebaseUid: string;
};

@Injectable()
export class UserRepository extends BaseDBUtil<UserEntity, CreateUserData> {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    super(UserEntity, userRepo);
  }

  async create(params: {
    creationData: CreateUserData;
    entityManager?: EntityManager;
  }): Promise<UserEntity> {
    const { creationData, entityManager } = params;
    const repo =
      (entityManager?.getRepository(UserEntity) as Repository<UserEntity>) ??
      this.userRepo;

    const user = repo.create({
      email: creationData.email,
      firebaseUid: creationData.firebaseUid,
    });

    return await repo.save(user);
  }
}
