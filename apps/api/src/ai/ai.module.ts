import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiAskService } from './ai-ask.service';
import { AiSearchService } from './ai-search.service';
import { ChartBuilderService } from './chart.service';
import { AiQuotaService } from './ai-quota';
import { InsightsService } from './insights.service';
import { HeuristicClassifier } from './classifier/heuristic.classifier';
import { LlmClassifier } from './classifier/llm.classifier';
import { GreetingService } from './templates/greeting.service';
import { AuditModule } from '../audit/audit.module';
import { ScheduleModule } from '../schedule/schedule.module';

@Module({
  imports: [AuditModule, ScheduleModule],
  controllers: [AiController],
  providers: [
    AiAskService,
    AiSearchService,
    ChartBuilderService,
    InsightsService,
    AiQuotaService,
    HeuristicClassifier,
    LlmClassifier,
    GreetingService,
  ],
})
export class AiModule {}
