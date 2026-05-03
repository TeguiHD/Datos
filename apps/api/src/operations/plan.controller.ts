import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { requestContext } from '../common/request-context';
import { GenerateExecutionsDto, UpsertPlanTaskDto } from './operations.dto';
import { PlanService } from './plan.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR, Role.VIEWER)
@Controller()
export class PlanController {
  constructor(private plan: PlanService) {}

  @Get('plantas/:psr/plan')
  listByPlant(@Param('psr') psr: string) {
    return this.plan.listByPlant(psr);
  }

  @Post('plantas/:psr/plan')
  @Roles(Role.SUPERADMIN)
  create(@CurrentUser() user: { id: string }, @Param('psr') psr: string, @Body() body: UpsertPlanTaskDto, @Req() req: Request) {
    return this.plan.create(user.id, psr, body, requestContext(req));
  }

  @Patch('tareas-programadas/:id')
  @Roles(Role.SUPERADMIN)
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: UpsertPlanTaskDto, @Req() req: Request) {
    return this.plan.update(user.id, id, body, requestContext(req));
  }

  @Delete('tareas-programadas/:id')
  @Roles(Role.SUPERADMIN)
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: Request) {
    return this.plan.remove(user.id, id, requestContext(req));
  }

  @Post('tareas-programadas/:id/generar-ejecuciones')
  @Roles(Role.SUPERADMIN)
  generateExecutions(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: GenerateExecutionsDto,
    @Req() req: Request,
  ) {
    return this.plan.generateExecutions(user.id, id, body, requestContext(req));
  }
}
