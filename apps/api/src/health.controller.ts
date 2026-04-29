import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @SkipThrottle()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', ts: new Date().toISOString() };
  }
}
