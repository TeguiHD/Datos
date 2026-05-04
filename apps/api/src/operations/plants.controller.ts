import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { requestContext } from '../common/request-context';
import { DeletePlantDto, ListPlantsDto, UpdatePlantDto, UpsertPlantDto } from './operations.dto';
import { PlantsService } from './plants.service';

@Controller('plantas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR, Role.VIEWER)
export class PlantsController {
  constructor(private plants: PlantsService) {}

  @Get()
  list(@CurrentUser() user: { role: Role }, @Query() query: ListPlantsDto) {
    return this.plants.list(user, query);
  }

  @Get(':psr/resumen')
  summary(@CurrentUser() user: { role: Role }, @Param('psr') psr: string) {
    return this.plants.summary(user, psr);
  }

  @Get(':psr/historico')
  history(@CurrentUser() user: { role: Role }, @Param('psr') psr: string, @Query('take') take?: string) {
    const n = take ? Number(take) : undefined;
    const safeTake = n !== undefined && Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 200) : undefined;
    return this.plants.history(user, psr, safeTake);
  }

  @Get(':psr')
  byPsr(@CurrentUser() user: { role: Role }, @Param('psr') psr: string) {
    return this.plants.byPsr(user, psr);
  }

  @Post()
  @Roles(Role.SUPERADMIN)
  create(@CurrentUser() user: { id: string }, @Body() body: UpsertPlantDto, @Req() req: Request) {
    return this.plants.create(user.id, body, requestContext(req));
  }

  @Patch(':psr')
  @Roles(Role.SUPERADMIN)
  update(@CurrentUser() user: { id: string }, @Param('psr') psr: string, @Body() body: UpdatePlantDto, @Req() req: Request) {
    return this.plants.update(user.id, psr, body, requestContext(req));
  }

  @Delete(':psr')
  @Roles(Role.SUPERADMIN)
  remove(@CurrentUser() user: { id: string }, @Param('psr') psr: string, @Body() body: DeletePlantDto, @Req() req: Request) {
    return this.plants.remove(user.id, psr, body, requestContext(req));
  }
}
