import { Injectable } from '@nestjs/common';
import { UserEntity } from 'src/db/entities/user.entity';
import { UserRepository } from '../repositories/user.repository';

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

    // NOTE: Potential race condition - concurrent requests for a new user
    // may both pass the check above and attempt to create. Consider implementing
    // upsert or wrapping in a transaction with unique constraint handling.
    return await this.userRepository.create({
      creationData: { email, firebaseUid },
    });
  }
}
