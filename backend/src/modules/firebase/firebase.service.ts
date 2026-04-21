import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { EnvironmentVariableUtil } from 'src/modules/common/utils/environment-variable.util';

const FIREBASE_APP_NAME = 'maintenance-tracker';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private _app: admin.app.App | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly envUtil: EnvironmentVariableUtil,
  ) {}

  onModuleInit(): void {
    this.applyEmulatorEnv();

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

  // The Admin SDK auto-recognizes process.env.FIREBASE_AUTH_EMULATOR_HOST.
  // We control that env var explicitly here so the SDK can never silently
  // route to an emulator unless our gate is on AND we provide a host.
  private applyEmulatorEnv(): void {
    const { enableMockAuth } = this.envUtil.getFeatureFlags();
    if (enableMockAuth) {
      const host = this.configService.getOrThrow<string>(
        'FIREBASE_AUTH_EMULATOR_HOST',
      );
      process.env.FIREBASE_AUTH_EMULATOR_HOST = host;
    } else {
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    }
  }

  get app(): admin.app.App {
    if (!this._app) {
      throw new InternalServerErrorException('Firebase app is not initialised');
    }
    return this._app;
  }
}
