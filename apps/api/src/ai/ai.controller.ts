import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, Length } from 'class-validator';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators';
import { AiSearchService } from './ai-search.service';
import { ChartBuilderService } from './chart.service';
import { requestContext } from '../common/request-context';

class AiSearchDto {
  @IsString() @Length(2, 500) prompt!: string;
}

class AiChartDto {
  @IsString() @Length(2, 500) prompt!: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR, Role.VIEWER)
export class AiController {
  constructor(
    private ai: AiSearchService,
    private chart: ChartBuilderService,
  ) {}

  @Post('search')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  search(
    @CurrentUser() u: { id: string; role: Role },
    @Body() body: AiSearchDto,
    @Req() req: Request,
  ) {
    return this.ai.search(u, body.prompt, requestContext(req));
  }

  @Post('chart')
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  buildChart(
    @CurrentUser() u: { id: string; role: Role },
    @Body() body: AiChartDto,
    @Req() req: Request,
  ) {
    return this.chart.build(u, body.prompt, requestContext(req));
  }
}
