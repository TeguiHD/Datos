import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN)
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  list(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ) {
    return this.audit.list({
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
      userId,
      action,
    });
  }

  @Get('verify')
  verify() {
    return this.audit.verifyChain();
  }
}
