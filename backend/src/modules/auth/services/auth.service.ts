import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { UserEntity } from 'src/db/entities/user.entity';
import { UserRepository } from '../repositories/user.repository';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async resolveUser(params: {
    firebaseUid: string;
    email: string;
  }): Promise<UserEntity> {
    const { firebaseUid, email } = params;

    const existing = await this.userRepository.getOne({
      criteria: { firebaseUid },
    });

    if (existing) return existing;

    try {
      return await this.userRepository.create({
        creationData: { email, firebaseUid },
      });
    } catch (err) {
      // Concurrent requests can both pass the getOne check and race to INSERT.
      // If this request lost the race, the other request already created the user —
      // re-query to return it.
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code: string }).code ===
          PG_UNIQUE_VIOLATION
      ) {
        const created = await this.userRepository.getOne({
          criteria: { firebaseUid },
        });
        if (created) return created;
      }
      throw err;
    }
  }
}
