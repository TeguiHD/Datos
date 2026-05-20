import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { MaterializeService } from './materialize.service';
import { AuditModule } from '../audit/audit.module';
import { HhDefaultsModule } from '../hh-defaults/hh-defaults.module';

@Module({
  imports: [AuditModule, HhDefaultsModule],
  providers: [ScheduleService, MaterializeService],
  controllers: [ScheduleController],
  exports: [ScheduleService, MaterializeService],
})
export class ScheduleModule {}
