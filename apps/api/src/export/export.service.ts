import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
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

interface ExportRow {
  id: string;
  planta: string;
  titulo: string;
  tipo: string;
  frecuencia: string;
  hh: number;
  responsable: string;
  proxima: string;
  estado: string;
}

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  private async fetchRows(user: { role: Role }, plantId?: string): Promise<ExportRow[]> {
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
    return tasks.map((t) => {
      const next = t.executions[0];
      return {
        id: t.posicionMant ?? '',
        planta: t.plant?.name ?? '',
        titulo: t.titulo ?? t.descPosicionMant ?? '',
        tipo: TIPO_LABEL[t.tipo] ?? t.tipo,
        frecuencia: FREQ_LABEL[t.frecuenciaCodigo ?? ''] ?? t.frecuenciaCodigo ?? '',
        hh: t.hhReal != null ? Number(t.hhReal) : 0,
        responsable: t.responsable ?? '',
        proxima: next ? next.dueDate.toISOString().slice(0, 10) : '',
        estado: next ? (ESTADO_LABEL[next.status] ?? next.status) : 'Al día',
      };
    });
  }

  private async plantName(plantId?: string): Promise<string> {
    if (!plantId) return 'Todas las plantas';
    const p = await this.prisma.plant.findUnique({ where: { id: plantId }, select: { name: true } });
    return p?.name ?? 'Planta';
  }

  /** Exporta las mantenciones a un Excel, opcionalmente filtrado por planta. */
  async maintenancesXlsx(user: { role: Role }, plantId?: string): Promise<{ buffer: Buffer; filename: string }> {
    const rows = await this.fetchRows(user, plantId);

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

    for (const r of rows) ws.addRow(r);

    ws.autoFilter = { from: 'A1', to: 'I1' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `mantenciones-${plantId ? 'planta' : 'todas'}-${stamp}.xlsx`;
    return { buffer, filename };
  }

  /** Exporta las mantenciones a un PDF presentable, opcionalmente por planta. */
  async maintenancesPdf(user: { role: Role }, plantId?: string): Promise<{ buffer: Buffer; filename: string }> {
    const [rows, plantLabel] = await Promise.all([this.fetchRows(user, plantId), this.plantName(plantId)]);
    const stamp = new Date().toISOString().slice(0, 10);

    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((res) => doc.on('end', () => res()));

    doc.fontSize(16).fillColor('#0f172a').text('Informe de mantenciones', { continued: false });
    doc.fontSize(10).fillColor('#64748b').text(`${plantLabel} · ${rows.length} mantenciones · ${stamp}`);
    doc.moveDown(0.8);

    const cols = [
      { key: 'id', label: 'ID', w: 70 },
      { key: 'planta', label: 'Planta', w: 80 },
      { key: 'titulo', label: 'Título', w: 230 },
      { key: 'tipo', label: 'Tipo', w: 70 },
      { key: 'frecuencia', label: 'Frecuencia', w: 70 },
      { key: 'hh', label: 'HH', w: 40 },
      { key: 'responsable', label: 'Responsable', w: 110 },
      { key: 'estado', label: 'Estado', w: 65 },
    ] as const;
    const startX = doc.page.margins.left;
    const rowH = 18;

    const drawHeader = (y: number) => {
      doc.rect(startX, y, doc.page.width - startX - doc.page.margins.right, rowH).fill('#e2e8f0');
      let x = startX;
      doc.fontSize(8).fillColor('#0f172a');
      for (const c of cols) {
        doc.text(c.label, x + 4, y + 5, { width: c.w - 6, ellipsis: true });
        x += c.w;
      }
      return y + rowH;
    };

    let y = drawHeader(doc.y);
    const bottom = doc.page.height - doc.page.margins.bottom;
    for (const r of rows) {
      if (y + rowH > bottom) {
        doc.addPage();
        y = drawHeader(doc.page.margins.top);
      }
      let x = startX;
      doc.fontSize(8).fillColor('#334155');
      for (const c of cols) {
        const val = c.key === 'hh' ? String(r.hh) : String(r[c.key] ?? '');
        doc.text(val, x + 4, y + 5, { width: c.w - 6, ellipsis: true });
        x += c.w;
      }
      doc.moveTo(startX, y + rowH).lineTo(doc.page.width - doc.page.margins.right, y + rowH).strokeColor('#e2e8f0').stroke();
      y += rowH;
    }

    doc.end();
    await done;
    const filename = `mantenciones-${plantId ? 'planta' : 'todas'}-${stamp}.pdf`;
    return { buffer: Buffer.concat(chunks), filename };
  }
}
