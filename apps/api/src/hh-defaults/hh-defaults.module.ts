import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { HhDefaultsController } from './hh-defaults.controller';
import { HhDefaultsService } from './hh-defaults.service';
import { HhResolverService } from './hh-resolver';

@Module({
  imports: [AuditModule],
  controllers: [HhDefaultsController],
  providers: [HhDefaultsService, HhResolverService],
  exports: [HhResolverService],
})
export class HhDefaultsModule {}
