import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AdminController } from './admin.controller';
import { ImportService } from './import.service';
import { AuditModule } from '../audit/audit.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { PlantCatalogService } from '../operations/plant-catalog.service';

@Module({
  imports: [
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024, files: 1 } }),
    AuditModule,
    ScheduleModule,
  ],
  controllers: [AdminController],
  providers: [ImportService, PlantCatalogService],
})
export class AdminModule {}
