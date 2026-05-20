import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { requestContext } from '../common/request-context';
import { ReportsService } from './reports.service';
import { MonthlyReportDto } from './reports.dto';

interface AuthRequest {
  user: { id: string; role: Role };
  ip: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Post('monthly')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async monthly(@Req() req: AuthRequest, @Res() res: Response, @Body() dto: MonthlyReportDto) {
    const ctx = requestContext(req as unknown as Parameters<typeof requestContext>[0]);
    const out = await this.reports.generateMonthly(req.user, dto, ctx);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.setHeader('X-Report-Id', out.reportId);
    res.setHeader('X-Report-Sha256', out.sha256);
    res.setHeader('X-Report-Signature', out.signature);
    res.status(200).send(out.buffer);
  }

  @Get(':id/verify')
  verify(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.reports.verify(req.user, id);
  }
}
