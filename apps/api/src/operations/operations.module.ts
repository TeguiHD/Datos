import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { EvidenceStorage } from './evidence.storage';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';
import { PlantsController } from './plants.controller';
import { PlantsService } from './plants.service';
import { PlantCatalogService } from './plant-catalog.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [
    PlantsController,
    EquipmentController,
    PlanController,
    ExecutionsController,
    EvidenceController,
    DashboardController,
  ],
  providers: [
    PlantsService,
    EquipmentService,
    PlanService,
    ExecutionsService,
    EvidenceService,
    EvidenceStorage,
    DashboardService,
    PlantCatalogService,
  ],
})
export class OperationsModule {}
