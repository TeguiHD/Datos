import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ResolveQuery {
  plantId: string | null;
  frecuenciaCodigo: string | null;
  abc: string | null;
}

interface Rule {
  scope: string;
  plantId: string | null;
  frecuenciaCodigo: string | null;
  abc: string | null;
  hhPlan: number;
  priority: number;
}

// Especificidad (mayor = más específico).
const SCOPE_RANK: Record<string, number> = {
  PLANT_FREQ_ABC: 60,
  PLANT_FREQ: 50,
  PLANT_ABC: 45,
  PLANT: 40,
  FREQ_ABC: 30,
  FREQ: 20,
  ABC: 10,
  GLOBAL: 0,
};

function matches(rule: Rule, q: ResolveQuery): boolean {
  if (rule.plantId && rule.plantId !== q.plantId) return false;
  if (rule.frecuenciaCodigo && rule.frecuenciaCodigo !== q.frecuenciaCodigo) return false;
  if (rule.abc && rule.abc !== q.abc) return false;
  return true;
}

@Injectable()
export class HhResolverService {
  constructor(private prisma: PrismaService) {}

  private cache: Rule[] | null = null;
  private cacheLoadedAt = 0;
  private readonly TTL_MS = 60_000;

  async refresh(): Promise<void> {
    const rows = await this.prisma.hhDefault.findMany({});
    this.cache = rows.map((r) => ({
      scope: r.scope,
      plantId: r.plantId,
      frecuenciaCodigo: r.frecuenciaCodigo,
      abc: r.abc,
      hhPlan: Number(r.hhPlan),
      priority: r.priority,
    }));
    this.cacheLoadedAt = Date.now();
  }

  private async ensureLoaded(): Promise<Rule[]> {
    if (this.cache && Date.now() - this.cacheLoadedAt < this.TTL_MS) return this.cache;
    await this.refresh();
    return this.cache ?? [];
  }

  async resolve(q: ResolveQuery): Promise<number | null> {
    const rules = await this.ensureLoaded();
    let best: Rule | null = null;
    for (const rule of rules) {
      if (!matches(rule, q)) continue;
      if (!best) { best = rule; continue; }
      const a = SCOPE_RANK[rule.scope] ?? 0;
      const b = SCOPE_RANK[best.scope] ?? 0;
      if (a > b || (a === b && rule.priority > best.priority)) best = rule;
    }
    return best ? best.hhPlan : null;
  }

  async resolveMany(queries: ResolveQuery[]): Promise<Array<number | null>> {
    await this.ensureLoaded();
    return Promise.all(queries.map((q) => this.resolve(q)));
  }

  invalidate(): void {
    this.cache = null;
    this.cacheLoadedAt = 0;
  }
}
