import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { ExportService } from './export.service';

interface AuthRequest {
  user: { role: Role };
}

@Controller('export')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR, Role.VIEWER)
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Get('mantenciones')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async maintenances(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
    @Query('plantId') plantId?: string,
    @Query('format') format?: string,
  ) {
    const plant = plantId || undefined;
    if (format === 'pdf') {
      const out = await this.exportService.maintenancesPdf(req.user, plant);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
      return out.buffer;
    }
    const out = await this.exportService.maintenancesXlsx(req.user, plant);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    return out.buffer;
  }
}
