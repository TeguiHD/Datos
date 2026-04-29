import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MaterializeService } from '../schedule/materialize.service';
import { parseExcelBuffer } from './excel-parser';

@Injectable()
export class ImportService {
  private readonly log = new Logger(ImportService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private materialize: MaterializeService,
  ) {}

  async importFile(
    userId: string | null,
    filename: string,
    buffer: Buffer,
    ctx: { ip: string; userAgent: string },
  ) {
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const parsed = await parseExcelBuffer(buffer);

    const run = await this.prisma.importRun.create({
      data: {
        userId,
        filename,
        fileHash,
        rowsTotal: parsed.tasks.length,
        rowsOk: 0,
        rowsErr: 0,
        status: 'RUNNING',
      },
    });

    let ok = 0;
    let err = 0;

    for (const item of parsed.tasks) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const existing = item.sourceRowHash
            ? await tx.maintenanceTask.findFirst({ where: { sourceRowHash: item.sourceRowHash } })
            : null;
          const task = existing
            ? await tx.maintenanceTask.update({ where: { id: existing.id }, data: item.task })
            : await tx.maintenanceTask.create({ data: { ...item.task, sourceRowHash: item.sourceRowHash } });

          await tx.monthlySchedule.deleteMany({ where: { taskId: task.id, source: 'EXCEL' } });
          if (item.schedule.length > 0) {
            await tx.monthlySchedule.createMany({
              data: item.schedule.map((s) => ({
                taskId: task.id,
                year: s.year,
                month: s.month,
                hh: s.hh,
                source: 'EXCEL',
              })),
              skipDuplicates: true,
            });
          }
        });
        ok++;
      } catch (e) {
        err++;
        this.log.error(`import row error: ${(e as Error).message}`);
      }
    }

    await this.prisma.importRun.update({
      where: { id: run.id },
      data: { rowsOk: ok, rowsErr: err, status: err === 0 ? 'SUCCESS' : 'PARTIAL' },
    });
    await this.audit.record({
      userId,
      action: 'EXCEL_IMPORT',
      entity: 'ImportRun',
      entityId: run.id,
      after: { filename, fileHash, ok, err },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    // Regenera proyecciones futuras + ejecuciones tras cada import (idempotente)
    const matResult = await this.materialize.rebuildAll(userId, ctx);

    return { id: run.id, ok, err, total: parsed.tasks.length, materialize: matResult };
  }
}
