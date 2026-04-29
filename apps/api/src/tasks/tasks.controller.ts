import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators';
import { TasksService } from './tasks.service';
import { ListTasksDto, UpsertScheduleDto, UpsertTaskDto } from './tasks.dto';
import { requestContext } from '../common/request-context';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR, Role.VIEWER)
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Get()
  list(@Query() query: ListTasksDto) {
    return this.tasks.list(query);
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.tasks.byId(id);
  }

  @Post()
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR)
  create(@CurrentUser() user: { id: string }, @Body() body: UpsertTaskDto, @Req() req: Request) {
    return this.tasks.create(user.id, body, requestContext(req));
  }

  @Patch(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR)
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: UpsertTaskDto,
    @Req() req: Request,
  ) {
    return this.tasks.update(user.id, id, body, requestContext(req));
  }

  @Delete(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: Request) {
    return this.tasks.remove(user.id, id, requestContext(req));
  }

  @Put(':id/schedule')
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR)
  setSchedule(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: UpsertScheduleDto,
    @Req() req: Request,
  ) {
    return this.tasks.upsertSchedule(user.id, id, body, requestContext(req));
  }
}
