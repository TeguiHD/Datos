import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MaterializeService } from '../schedule/materialize.service';
import { parseExcelBuffer } from './excel-parser';

const TEMPLATE_CORE_HEADERS = [
  'Andamios',
  'Materiales',
  'Comentarios',
  'PSR',
  'Centro planificación',
  'Clase actividad PM',
  'Clase de orden',
  'Campo de clasificación',
  'Plan mant.preventivo',
  'Estrategia mantenim.',
  'Descripción posición de mantenimiento',
  'Última orden',
  'Indicador ABC',
  'Ubicación técnica',
  'Denominación de la ubicación técnica',
  'Posición mantenim.',
  'Pto.tbjo.responsable',
  'Equipo',
  'Denominación de objeto técnico',
  'Tipo de hoja de ruta',
  'Grupo hojas ruta',
  'Cont.grupo HRuta',
  'Hojaruta',
  'Creado el',
  'Clave Modelo',
  'Frecuencia',
  'HH Real',
  'Frecuencia',
  'Mes de inicio',
];

const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

@Injectable()
export class ImportService {
  private readonly log = new Logger(ImportService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private materialize: MaterializeService,
  ) {}

  async template() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'datos.nicoholas.dev';
    wb.created = new Date();
    const ws = wb.addWorksheet('Plantilla SAP PM');

    ws.getCell('A1').value = 'Plantilla de importación datos.nicoholas.dev';
    ws.getCell('A2').value = 'Completa los encabezados en la fila 8 y los datos desde la fila 9. No elimines columnas base.';
    ws.getCell('A3').value = 'Las columnas mensuales aceptan HH numéricas. Ejemplo: ene-26, feb-26, mar-26.';

    const header = ws.getRow(8);
    TEMPLATE_CORE_HEADERS.forEach((label, index) => {
      header.getCell(index + 1).value = label;
    });

    let col = TEMPLATE_CORE_HEADERS.length + 1;
    for (let year = 2026; year <= 2028; year++) {
      for (let month = 1; month <= 12; month++) {
        header.getCell(col).value = `${MONTH_LABELS[month - 1]}-${String(year).slice(-2)}`;
        col++;
      }
    }

    ws.getRow(9).values = [
      undefined,
      'No',
      'Material estándar',
      'Ejemplo de carga',
      'PSR DEMO',
      'CENTRO-01',
      null,
      null,
      null,
      'PM-0001',
      'ANUAL',
      'Inspección preventiva ejemplo',
      null,
      'A',
      'UT-DEMO-001',
      'Línea demo',
      null,
      null,
      'EQ-DEMO-001',
      'Bomba de muestra',
      null,
      null,
      null,
      null,
      new Date(Date.UTC(2026, 0, 1)),
      null,
      'ANUAL',
      2.5,
      12,
      1,
      2.5,
    ];

    ws.views = [{ state: 'frozen', ySplit: 8 }];
    ws.columns.forEach((column, index) => {
      column.width = index < 29 ? 20 : 10;
    });
    header.font = { bold: true };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
  }

  async previewFile(filename: string, buffer: Buffer) {
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const parsed = await parseExcelBuffer(buffer);
    const hashes = parsed.tasks.map((item) => item.sourceRowHash);
    const existing = hashes.length
      ? await this.prisma.maintenanceTask.findMany({
          where: { sourceRowHash: { in: hashes } },
          select: { sourceRowHash: true },
        })
      : [];
    const existingHashes = new Set(existing.map((row) => row.sourceRowHash).filter(Boolean));
    const duplicateHashes = hashes.filter((hash, index) => hashes.indexOf(hash) !== index);
    const scheduleCells = parsed.tasks.reduce((sum, item) => sum + item.schedule.length, 0);

    return {
      filename,
      fileHash,
      totalRows: parsed.tasks.length,
      scheduleCells,
      existingRows: parsed.tasks.filter((item) => existingHashes.has(item.sourceRowHash)).length,
      newRows: parsed.tasks.filter((item) => !existingHashes.has(item.sourceRowHash)).length,
      duplicateRowsInFile: new Set(duplicateHashes).size,
      issues: [
        ...(parsed.tasks.length === 0 ? ['La plantilla no contiene filas válidas desde la fila 9.'] : []),
        ...(scheduleCells === 0 ? ['No se detectaron celdas mensuales con HH mayor a cero.'] : []),
        ...(duplicateHashes.length > 0 ? [`${new Set(duplicateHashes).size} filas repetidas dentro del archivo.`] : []),
      ],
      sample: parsed.tasks.slice(0, 8).map((item) => ({
        psr: item.task.psr ?? null,
        centroPlanificacion: item.task.centroPlanificacion ?? null,
        indicadorAbc: item.task.indicadorAbc ?? null,
        frecuenciaCodigo: item.task.frecuenciaCodigo ?? null,
        hhReal: item.task.hhReal ?? null,
        descripcion: item.task.descPosicionMant ?? item.task.denomObjetoTecnico ?? null,
        scheduleCount: item.schedule.length,
      })),
    };
  }

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
