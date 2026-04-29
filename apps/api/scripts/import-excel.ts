import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { parseExcelBuffer } from '../src/admin/excel-parser';

async function main() {
  const fileFlag = process.argv.findIndex((a) => a === '--file');
  if (fileFlag < 0 || !process.argv[fileFlag + 1]) {
    console.error('Usage: tsx scripts/import-excel.ts --file <path.xlsx> [--check]');
    process.exit(2);
  }
  const path = process.argv[fileFlag + 1]!;
  const check = process.argv.includes('--check');

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

  const prisma = new PrismaClient();
  let ok = 0;
  let err = 0;
  for (const item of parsed.tasks) {
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.maintenanceTask.findFirst({ where: { sourceRowHash: item.sourceRowHash } });
        const task = existing
          ? await tx.maintenanceTask.update({ where: { id: existing.id }, data: item.task })
          : await tx.maintenanceTask.create({ data: { ...item.task, sourceRowHash: item.sourceRowHash } });
        await tx.monthlySchedule.deleteMany({ where: { taskId: task.id } });
        if (item.schedule.length > 0) {
          await tx.monthlySchedule.createMany({
            data: item.schedule.map((s) => ({ taskId: task.id, year: s.year, month: s.month, hh: s.hh })),
            skipDuplicates: true,
          });
        }
      });
      ok++;
    } catch (e) {
      err++;
      console.error('row error:', (e as Error).message);
    }
  }

  console.log(`[import] ok=${ok} err=${err}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
