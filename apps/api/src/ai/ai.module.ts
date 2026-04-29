import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiSearchService } from './ai-search.service';
import { ChartBuilderService } from './chart.service';
import { AiQuotaService } from './ai-quota';
import { InsightsService } from './insights.service';
import { AuditModule } from '../audit/audit.module';
import { ScheduleModule } from '../schedule/schedule.module';

@Module({
  imports: [AuditModule, ScheduleModule],
  controllers: [AiController],
  providers: [AiSearchService, ChartBuilderService, InsightsService, AiQuotaService],
})
export class AiModule {}
