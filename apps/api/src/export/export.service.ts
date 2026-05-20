import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { plantWhereForUser, type ViewerScopeUser } from '../common/viewer-scope';

const FREQ_LABEL: Record<string, string> = {
  '1M': 'Mensual',
  '3M': 'Trimestral',
  '6M': 'Semestral',
  '1A': 'Anual',
  '5A': 'Quinquenal',
};

const TIPO_LABEL: Record<string, string> = {
  PREVENTIVA: 'Preventiva',
  CORRECTIVA: 'Correctiva',
  PREDICTIVA: 'Predictiva',
};

const ESTADO_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  OVERDUE: 'Vencida',
  DONE: 'Al día',
  SKIPPED: 'Omitida',
};

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  /** Exporta las mantenciones a un Excel, opcionalmente filtrado por planta. */
  async maintenancesXlsx(user: { role: Role }, plantId?: string): Promise<{ buffer: Buffer; filename: string }> {
    const visible: ViewerScopeUser = { role: user.role };
    const tasks = await this.prisma.maintenanceTask.findMany({
      where: {
        deletedAt: null,
        ...(plantId ? { plantId } : {}),
        plant: plantWhereForUser(visible),
      },
      include: {
        plant: { select: { name: true } },
        executions: { where: { status: { in: ['PENDING', 'OVERDUE'] } }, orderBy: { dueDate: 'asc' }, take: 1 },
      },
      orderBy: [{ plant: { name: 'asc' } }, { titulo: 'asc' }],
      take: 20000,
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'datos.nicoholas.dev';
    wb.created = new Date();
    const ws = wb.addWorksheet('Mantenciones');

    ws.columns = [
      { header: 'ID (Posición)', key: 'id', width: 16 },
      { header: 'Planta', key: 'planta', width: 18 },
      { header: 'Título', key: 'titulo', width: 42 },
      { header: 'Tipo', key: 'tipo', width: 13 },
      { header: 'Frecuencia', key: 'frecuencia', width: 14 },
      { header: 'HH', key: 'hh', width: 8 },
      { header: 'Responsable', key: 'responsable', width: 22 },
      { header: 'Próxima', key: 'proxima', width: 13 },
      { header: 'Estado', key: 'estado', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    for (const t of tasks) {
      const next = t.executions[0];
      ws.addRow({
        id: t.posicionMant ?? '',
        planta: t.plant?.name ?? '',
        titulo: t.titulo ?? t.descPosicionMant ?? '',
        tipo: TIPO_LABEL[t.tipo] ?? t.tipo,
        frecuencia: FREQ_LABEL[t.frecuenciaCodigo ?? ''] ?? t.frecuenciaCodigo ?? '',
        hh: t.hhReal != null ? Number(t.hhReal) : 0,
        responsable: t.responsable ?? '',
        proxima: next ? next.dueDate.toISOString().slice(0, 10) : '',
        estado: next ? ESTADO_LABEL[next.status] : 'Al día',
      });
    }

    ws.autoFilter = { from: 'A1', to: 'I1' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `mantenciones-${plantId ? 'planta' : 'todas'}-${stamp}.xlsx`;
    return { buffer, filename };
  }
}
