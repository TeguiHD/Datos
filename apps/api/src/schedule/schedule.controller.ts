import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators';
import { ScheduleService } from './schedule.service';
import {
  CreateSavedViewDto,
  ExportExecutionsDto,
  GroupExecutionsDto,
  HeatmapDto,
  ListExecutionsDto,
  MonthlyDto,
  PlantListDto,
  PipelineDto,
  UpdateSavedViewDto,
  UpcomingDto,
  UpdateExecutionDto,
  YearDto,
} from './schedule.dto';
import { requestContext } from '../common/request-context';

@Controller('schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR, Role.VIEWER)
export class ScheduleController {
  constructor(private schedule: ScheduleService) {}

  @Get('monthly')
  monthly(@Query() q: MonthlyDto) {
    return this.schedule.monthly(q.year, q.month);
  }

  @Get('year')
  year(@Query() q: YearDto) {
    return this.schedule.yearSummary(q.year);
  }

  @Get('heatmap')
  heatmap(@Query() q: HeatmapDto) {
    return this.schedule.heatmap(q.from, q.to);
  }

  @Get('kpis')
  kpis() {
    return this.schedule.kpis();
  }

  @Get('upcoming')
  upcoming(@Query() q: UpcomingDto) {
    return this.schedule.upcoming(q.days ?? 7);
  }

  @Get('overdue')
  overdue() {
    return this.schedule.overdue();
  }

  @Get('whats-next')
  whatsNext() {
    return this.schedule.whatsNext();
  }

  @Get('plants')
  plants(@Query() q: PlantListDto) {
    return this.schedule.plants(q);
  }

  @Get('executions')
  executions(@Query() q: ListExecutionsDto) {
    return this.schedule.executions(q);
  }

  @Get('executions/export')
  async executionsExport(@Query() q: ExportExecutionsDto, @Res({ passthrough: true }) res: Response) {
    const out = await this.schedule.exportExecutions(q);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    return out.content;
  }

  @Get('executions/group')
  executionsGroup(@Query() q: GroupExecutionsDto) {
    return this.schedule.groupExecutions(q);
  }

  @Get('pipeline')
  pipeline(@Query() q: PipelineDto) {
    return this.schedule.pipeline(q);
  }

  @Get('views')
  views(@CurrentUser() u: { id: string }) {
    return this.schedule.listSavedViews(u.id);
  }

  @Post('views')
  createView(@CurrentUser() u: { id: string }, @Body() dto: CreateSavedViewDto, @Req() req: Request) {
    return this.schedule.createSavedView(u.id, dto, requestContext(req));
  }

  @Patch('views/:id')
  updateView(
    @CurrentUser() u: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateSavedViewDto,
    @Req() req: Request,
  ) {
    return this.schedule.updateSavedView(u.id, id, dto, requestContext(req));
  }

  @Delete('views/:id')
  deleteView(@CurrentUser() u: { id: string }, @Param('id') id: string, @Req() req: Request) {
    return this.schedule.deleteSavedView(u.id, id, requestContext(req));
  }

  @Patch('executions/:id')
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR)
  updateExecution(
    @CurrentUser() u: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateExecutionDto,
    @Req() req: Request,
  ) {
    return this.schedule.markExecution(u.id, id, dto, requestContext(req));
  }

  @Post('rebuild')
  @Throttle({ default: { ttl: 60_000, limit: 2 } })
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  rebuild(@CurrentUser() u: { id: string }, @Req() req: Request) {
    return this.schedule.rebuild(u.id, requestContext(req));
  }
}
