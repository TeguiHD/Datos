import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { requestContext } from '../common/request-context';
import {
  ListOperationalExecutionsDto,
  PostponeExecutionDto,
  RegisterExecutionDto,
  RejectExecutionDto,
  ReopenExecutionDto,
} from './operations.dto';
import { ExecutionsService } from './executions.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR, Role.VIEWER)
@Controller('ejecuciones')
export class ExecutionsController {
  constructor(private executions: ExecutionsService) {}

  @Get()
  list(@CurrentUser() user: { role: Role }, @Query() query: ListOperationalExecutionsDto) {
    return this.executions.list(user, query);
  }

  @Post(':id/registrar')
  @Roles(Role.SUPERADMIN)
  register(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: RegisterExecutionDto, @Req() req: Request) {
    return this.executions.register(user.id, id, body, requestContext(req));
  }

  @Post(':id/aprobar')
  @Roles(Role.SUPERADMIN)
  approve(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: Request) {
    return this.executions.approve(user.id, id, requestContext(req));
  }

  @Post(':id/rechazar')
  @Roles(Role.SUPERADMIN)
  reject(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: RejectExecutionDto, @Req() req: Request) {
    return this.executions.reject(user.id, id, body, requestContext(req));
  }

  @Post(':id/postergar')
  @Roles(Role.SUPERADMIN)
  postpone(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: PostponeExecutionDto, @Req() req: Request) {
    return this.executions.postpone(user.id, id, body, requestContext(req));
  }

  @Post(':id/reabrir')
  @Roles(Role.SUPERADMIN)
  reopen(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: ReopenExecutionDto, @Req() req: Request) {
    return this.executions.reopen(user.id, id, body, requestContext(req));
  }
}
