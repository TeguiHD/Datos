import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { requestContext } from '../common/request-context';
import { EquipmentService } from './equipment.service';
import { UpsertEquipmentDto } from './operations.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR, Role.VIEWER)
@Controller()
export class EquipmentController {
  constructor(private equipment: EquipmentService) {}

  @Get('plantas/:psr/equipos')
  listByPlant(@Param('psr') psr: string) {
    return this.equipment.listByPlant(psr);
  }

  @Post('plantas/:psr/equipos')
  @Roles(Role.SUPERADMIN)
  create(@CurrentUser() user: { id: string }, @Param('psr') psr: string, @Body() body: UpsertEquipmentDto, @Req() req: Request) {
    return this.equipment.create(user.id, psr, body, requestContext(req));
  }

  @Patch('equipos/:id')
  @Roles(Role.SUPERADMIN)
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: UpsertEquipmentDto, @Req() req: Request) {
    return this.equipment.update(user.id, id, body, requestContext(req));
  }

  @Delete('equipos/:id')
  @Roles(Role.SUPERADMIN)
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: Request) {
    return this.equipment.remove(user.id, id, requestContext(req));
  }
}
