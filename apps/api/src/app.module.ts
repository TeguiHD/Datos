import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { GlobalErrorFilter } from './common/error.filter';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { ScheduleModule } from './schedule/schedule.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { OperationsModule } from './operations/operations.module';
import { ReportsModule } from './reports/reports.module';
import { HhDefaultsModule } from './hh-defaults/hh-defaults.module';
import { HealthController } from './health.controller';
import { IdempotencyMiddleware } from './common/idempotency.middleware';
import { RequestIdMiddleware } from './common/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-csrf-token"]',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
          'req.body.code',
        ],
        customProps: (req) => ({ requestId: (req as { id?: string }).id }),
        autoLogging: {
          ignore: (req) => req.url === '/api/health' || req.url === '/api/auth/csrf',
        },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    TasksModule,
    ScheduleModule,
    AuditModule,
    AdminModule,
    AiModule,
    OperationsModule,
    ReportsModule,
    HhDefaultsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalErrorFilter },
    IdempotencyMiddleware,
    RequestIdMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes(
        { path: '*', method: RequestMethod.POST },
        { path: '*', method: RequestMethod.PATCH },
        { path: '*', method: RequestMethod.PUT },
        { path: '*', method: RequestMethod.DELETE },
      );
  }
}
