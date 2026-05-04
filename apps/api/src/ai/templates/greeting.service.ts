import { Injectable } from '@nestjs/common';
import { ExecStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { Suggestion } from '../dto/ask.dto';

@Injectable()
export class GreetingService {
  constructor(private prisma: PrismaService) {}

  async build(): Promise<{ message: string; suggestions: Suggestion[] }> {
    const [overdueCount, nextCount, topPsr] = await Promise.all([
      this.prisma.taskExecution.count({ where: { status: ExecStatus.OVERDUE } }),
      this.prisma.taskExecution.count({
        where: {
          status: ExecStatus.PENDING,
          dueDate: { gte: startOfTodayUtc(), lte: addDaysUtc(30) },
        },
      }),
      this.prisma.maintenanceTask.groupBy({
        by: ['psr'],
        where: { psr: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { psr: 'desc' } },
        take: 1,
      }),
    ]);

    const psr = topPsr[0]?.psr?.trim();
    const suggestions: Suggestion[] = [
      {
        type: 'prompt',
        label: overdueCount > 0 ? `Vencidas (${overdueCount})` : 'Revisar vencidas',
        prompt: 'vencidas',
      },
      {
        type: 'prompt',
        label: nextCount > 0 ? `Próximos 30 días (${nextCount})` : 'Próximos 30 días',
        prompt: 'próximos 30 días',
      },
      {
        type: 'prompt',
        label: psr ? `HH por mes PSR ${psr}` : 'HH por mes 2026',
        prompt: psr ? `gráfico HH planificadas por mes PSR ${psr}` : 'gráfico HH planificadas por mes 2026',
      },
    ];

    return {
      message: 'Hola. ¿Qué revisamos de la planificación de mantención?',
      suggestions,
    };
  }
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDaysUtc(days: number): Date {
  const start = startOfTodayUtc();
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + days, 23, 59, 59));
}
