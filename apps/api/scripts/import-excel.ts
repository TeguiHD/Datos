import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { ImportService } from '../src/admin/import.service';
import { parseExcelBuffer } from '../src/admin/excel-parser';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { MaterializeService } from '../src/schedule/materialize.service';
import { PlantCatalogService } from '../src/operations/plant-catalog.service';
import { HhResolverService } from '../src/hh-defaults/hh-resolver';

async function main() {
  const fileFlag = process.argv.findIndex((a) => a === '--file');
  if (fileFlag < 0 || !process.argv[fileFlag + 1]) {
    console.error('Usage: tsx scripts/import-excel.ts --file <path.xlsx> [--check] [--replace]');
    process.exit(2);
  }
  const path = process.argv[fileFlag + 1]!;
  const check = process.argv.includes('--check');
  const replace = process.argv.includes('--replace');

  const buf = await readFile(path);
  const parsed = await parseExcelBuffer(buf);
  console.log(`[import] parsed ${parsed.tasks.length} tasks from ${path}`);

  if (check) {
    const withSchedule = parsed.tasks.filter((t) => t.schedule.length > 0).length;
    const scheduleRows = parsed.tasks.reduce((n, t) => n + t.schedule.length, 0);
    console.log(`[check] tasksWithSchedule=${withSchedule} scheduleRows=${scheduleRows}`);
    console.log('[check] sample task keys:', Object.keys(parsed.tasks[0]?.task ?? {}));
    return;
  }

  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const audit = new AuditService(prisma);
    const hhResolver = new HhResolverService(prisma);
    const materialize = new MaterializeService(prisma, audit, hhResolver);
    const plantCatalog = new PlantCatalogService(prisma);
    const importer = new ImportService(prisma, audit, materialize, plantCatalog);

    if (replace) {
      const taskIds = (await prisma.maintenanceTask.findMany({
        where: { manualOverride: false },
        select: { id: true },
      })).map((task) => task.id);
      const [executions, schedules, tasks] = taskIds.length
        ? await prisma.$transaction([
            prisma.taskExecution.deleteMany({ where: { taskId: { in: taskIds } } }),
            prisma.monthlySchedule.deleteMany({ where: { taskId: { in: taskIds } } }),
            prisma.maintenanceTask.deleteMany({ where: { id: { in: taskIds } } }),
          ])
        : [{ count: 0 }, { count: 0 }, { count: 0 }];
      console.log(
        `[replace] deleted non-manual tasks=${tasks.count} schedules=${schedules.count} executions=${executions.count}`,
      );
    }

    const result = await importer.importFile(null, basename(path), buf, {
      ip: 'cli',
      userAgent: 'scripts/import-excel.ts',
    });

    console.log(`[import] ok=${result.ok} err=${result.err} total=${result.total}`);
    console.log(
      `[rebuild] tasks=${result.materialize.tasksProcessed} executionsCreated=${result.materialize.executionsCreated} discrepancies=${result.materialize.discrepancies} horizon=${result.materialize.horizonYear}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
