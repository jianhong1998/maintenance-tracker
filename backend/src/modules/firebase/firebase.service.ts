import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

const FIREBASE_APP_NAME = 'maintenance-tracker';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private _app: admin.app.App | undefined;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.configService.getOrThrow<string>(
      'FIREBASE_PROJECT_ID',
    );
    const clientEmail = this.configService.getOrThrow<string>(
      'FIREBASE_CLIENT_EMAIL',
    );
    const privateKey = this.configService
      .getOrThrow<string>('FIREBASE_PRIVATE_KEY')
      .replace(/\\n/g, '\n');

    const existing = admin.apps.find((a) => a?.name === FIREBASE_APP_NAME);
    if (existing) {
      this._app = existing;
      return;
    }

    this._app = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      },
      FIREBASE_APP_NAME,
    );
  }

  get app(): admin.app.App {
    if (!this._app) {
      throw new InternalServerErrorException('Firebase app is not initialised');
    }
    return this._app;
  }
}
