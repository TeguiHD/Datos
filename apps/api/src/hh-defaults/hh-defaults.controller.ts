import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { requestContext } from '../common/request-context';
import { HhDefaultsService } from './hh-defaults.service';
import { UpsertHhDefaultDto } from './hh-defaults.dto';

interface AuthRequest extends Request {
  user: { id: string; role: Role };
}

@Controller('hh-defaults')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN)
export class HhDefaultsController {
  constructor(private service: HhDefaultsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  upsert(@Req() req: AuthRequest, @Body() dto: UpsertHhDefaultDto) {
    return this.service.upsert(req.user, dto, requestContext(req));
  }

  @Delete(':id')
  remove(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.remove(req.user, id, requestContext(req));
  }

  @Post('backfill')
  backfill(@Req() req: AuthRequest) {
    return this.service.backfill(req.user, requestContext(req));
  }

  @Get('suggestions')
  suggestions() {
    return this.service.suggestFromHistory();
  }
}
