import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
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

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PlantsController, EquipmentController, PlanController, ExecutionsController, EvidenceController],
  providers: [PlantsService, EquipmentService, PlanService, ExecutionsService, EvidenceService, EvidenceStorage],
})
export class OperationsModule {}
