import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR, Role.VIEWER)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('hoy')
  hoy(@CurrentUser() user: { role: Role }) {
    return this.dashboard.hoy(user);
  }

  @Get('semana')
  semana(@CurrentUser() user: { role: Role }, @Query('offset') offset?: string) {
    const n = offset ? Number(offset) : 0;
    const safe = Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), -52), 52) : 0;
    return this.dashboard.semana(user, safe);
  }
}
