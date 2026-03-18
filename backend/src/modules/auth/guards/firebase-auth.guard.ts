import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UserEntity } from 'src/db/entities/user.entity';
import { FirebaseService } from 'src/modules/firebase/firebase.service';
import { AuthService } from '../services/auth.service';

const BEARER_PREFIX = 'Bearer ';
const API_TEST_TOKEN = 'api-test-token';
const API_TEST_FIREBASE_UID = 'api-test-uid';
const API_TEST_EMAIL = 'api-test@example.com';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const [, token] = authHeader.split(' ');
    if (!token || token.trim() === '') {
      throw new UnauthorizedException('Missing bearer token');
    }

    const isApiTestMode =
      this.configService.get<string>(
        'BACKEND_ENABLE_API_TEST_MODE',
        'false',
      ) === 'true';

    if (isApiTestMode && token === API_TEST_TOKEN) {
      const user = await this.authService.resolveUser({
        firebaseUid: API_TEST_FIREBASE_UID,
        email: API_TEST_EMAIL,
      });
      (request as Request & { user: UserEntity }).user = user;
      return true;
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
