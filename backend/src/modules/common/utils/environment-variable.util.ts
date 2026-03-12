import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type IEnvironmentVariableList = {
  // App Operation Related
  nodeEnv: string;
  port: number;
  buildMode: string;
  clientHost: string;
  cookieDomainName: string;
  cookieSecret: string;

  // Database Related
  databaseHost: string;
  databasePort: number;
  databaseUser: string;
  databasePassword: string;
  databaseDb: string;
};

type IFeatureFlagList = {
  // Feature Flag Related
  enableApiTestMode: boolean;
};

@Injectable()
export class EnvironmentVariableUtil {
  private environmentVariableList: IEnvironmentVariableList | undefined;
  private featureFlagList: IFeatureFlagList | undefined;

  constructor(private readonly configService: ConfigService) {}

  public getVariables(): IEnvironmentVariableList {
    if (this.environmentVariableList) return this.environmentVariableList;

    this.environmentVariableList = {
      nodeEnv: this.configService.get('NODE_ENV', 'dev'),
      buildMode: this.configService.get('BACKEND_BUILD_MODE', 'swc'),
      port: this.configService.get<number>('BACKEND_PORT', 3001),
      clientHost: this.configService.get(
        'BACKEND_CLIENT_HOST',
        'http://localhost:3000',
      ),
      cookieSecret: this.configService.get('BACKEND_COOKIE_SECRET', 'secret'),
      cookieDomainName: this.configService.get(
        'BACKEND_COOKIE_DOMAIN_NAME',
        'localhost',
      ),
      databaseHost: this.configService.get(
        'BACKEND_DATABASE_HOST',
        'localhost',
      ),
      databasePort: this.configService.get<number>('DATABASE_PORT', 5432),
      databaseUser: this.configService.get('DATABASE_USER', 'postgres'),
      databasePassword: this.configService.get('DATABASE_PASSWORD', 'postgres'),
      databaseDb: this.configService.get(
        'DATABASE_DB',
        'invoice_management_app_db',
      ),
    };

    return this.environmentVariableList;
  }

  public getFeatureFlags(): IFeatureFlagList {
    if (!this.featureFlagList) {
      this.featureFlagList = {
        enableApiTestMode:
          this.configService.get<string>(
            'BACKEND_ENABLE_API_TEST_MODE',
            'false',
          ) === 'true',
      };
    }

    return this.featureFlagList;
  }
}
