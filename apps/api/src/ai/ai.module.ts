import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiSearchService } from './ai-search.service';
import { ChartBuilderService } from './chart.service';
import { AiQuotaService } from './ai-quota';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [AiController],
  providers: [AiSearchService, ChartBuilderService, AiQuotaService],
})
export class AiModule {}
