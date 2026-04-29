import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { MaterializeService } from './materialize.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [ScheduleService, MaterializeService],
  controllers: [ScheduleController],
  exports: [ScheduleService, MaterializeService],
})
export class ScheduleModule {}
