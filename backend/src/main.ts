import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app/app.module';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser(configService.get('BACKEND_COOKIE_SECRET', 'secret')));
  app.useGlobalPipes(new ValidationPipe({ transform: true, always: true }));

  app.enableCors({
    origin: [
      ...configService.getOrThrow<string>('BACKEND_CLIENT_HOST').split(','),
    ],
    credential: true,
  });

  await app.listen(process.env.BACKEND_PORT ?? 3001);
}
void bootstrap();
