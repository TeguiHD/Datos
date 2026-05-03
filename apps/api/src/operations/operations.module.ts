import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';
import { PlantsController } from './plants.controller';
import { PlantsService } from './plants.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PlantsController, EquipmentController, PlanController],
  providers: [PlantsService, EquipmentService, PlanService],
})
export class OperationsModule {}
