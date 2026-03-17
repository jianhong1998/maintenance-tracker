import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { UserEntity } from 'src/db/entities/user.entity';
import { FirebaseService } from 'src/modules/firebase/firebase.service';
import { AuthService } from '../services/auth.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const [, token] = authHeader.split(' ');
    if (!token) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    let decoded: { uid: string; email?: string };
    try {
      decoded = await this.firebaseService.app.auth().verifyIdToken(token);
    } catch (err) {
      this.logger.warn('Token verification failed', err);
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!decoded.email) {
      throw new UnauthorizedException(
        'Firebase token must include an email address',
      );
    }

    const user = await this.authService.resolveUser({
      firebaseUid: decoded.uid,
      email: decoded.email,
    });

    (request as Request & { user: UserEntity }).user = user;
    return true;
  }
}
