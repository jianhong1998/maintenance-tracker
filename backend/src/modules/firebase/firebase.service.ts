import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private _app: admin.app.App;

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

    // Prevent re-initialisation if app already exists (e.g. in tests)
    if (admin.apps.length > 0) {
      this._app = admin.app();
      return;
    }

    this._app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  get app(): admin.app.App {
    return this._app;
  }
}
