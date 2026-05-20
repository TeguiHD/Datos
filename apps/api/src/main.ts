import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { csrfErrorHandler, csrfProtection } from './common/csrf';

function configureTrustProxy(app: unknown) {
  const maybeSet = (app as { set?: (name: string, value: unknown) => unknown }).set;
  if (!maybeSet) return;

  const set = maybeSet.bind(app as object);
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') set('trust proxy', 1);
    return;
  }

  const lowered = raw.toLowerCase();
  if (lowered === 'false' || lowered === '0') {
    set('trust proxy', false);
    return;
  }
  if (lowered === 'true') {
    set('trust proxy', 1);
    return;
  }

  const hops = Number(raw);
  if (Number.isInteger(hops) && hops >= 0) {
    set('trust proxy', hops);
    return;
  }

  set('trust proxy', raw);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureTrustProxy(app);
  app.useLogger(app.get(Logger));

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'none'"],
          'form-action': ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(cookieParser(process.env.COOKIE_SECRET));

  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'idempotency-key', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
    maxAge: 600,
  });

  app.use(csrfProtection);
  app.use(csrfErrorHandler);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`[api] listening on :${port}`);
}

bootstrap();
