export interface TaskBrief {
  id: string;
  descPosicionMant: string | null;
  denomObjetoTecnico: string | null;
  ubicacionTecnica: string | null;
  denomUbicacionTecnica?: string | null;
  indicadorAbc: string | null;
  psr: string | null;
  frecuenciaCodigo: string | null;
  equipo: string | null;
  hhReal: string | null;
  centroPlanificacion: string | null;
}

export type ExecStatus = 'PENDING' | 'DONE' | 'OVERDUE' | 'SKIPPED';

export interface ExecutionRow {
  id: string;
  taskId: string;
  dueDate: string;
  doneDate: string | null;
  hhPlanned: string;
  hhActual: string | null;
  status: ExecStatus;
  operator: string | null;
  notes: string | null;
  task: TaskBrief;
}

export interface ExecutionList {
  count: number;
  totalHh: number;
  rows: ExecutionRow[];
  days?: number;
}

export interface ExecutionStatusSplit {
  status: ExecStatus;
  count: number;
  totalHhPlanned: number;
  totalHhActual: number;
}

export interface ExecutionAnalyticsList {
  rows: ExecutionRow[];
  total: number;
  take: number;
  skip: number;
  totalHhPlanned: number;
  totalHhActual: number;
  statusSplit: ExecutionStatusSplit[];
}

export interface ExecutionGroupRow {
  key: string;
  count: number;
  totalHhPlanned: number;
  totalHhActual: number;
}

export interface ExecutionGroupResult {
  groupBy: 'status' | 'abc' | 'frecuencia' | 'psr' | 'centroPlanificacion';
  count: number;
  rows: ExecutionGroupRow[];
}

export interface PipelineMonthPoint {
  year: number;
  month: number;
  pending: number;
  overdue: number;
  done: number;
  skipped: number;
  plannedHh: number;
  actualHh: number;
  backlog: number;
  closed: number;
}

export interface PipelineResult {
  range: {
    from: string;
    to: string;
  };
  totals: {
    pending: number;
    overdue: number;
    done: number;
    skipped: number;
    plannedHh: number;
    actualHh: number;
    completionRate: number;
  };
  byMonth: PipelineMonthPoint[];
  abcSplit: { key: string; count: number }[];
  freqSplit: { key: string; count: number }[];
  process: {
    imports: {
      running: number;
      success: number;
      partial: number;
      total: number;
      rowsErr: number;
    };
    rebuildRuns: number;
    discrepancyCount: number;
  };
}

export interface ExecutionViewFilters {
  q?: string;
  status?: ExecStatus;
  abc?: string;
  frecuencia?: string;
  psr?: string;
  centroPlanificacion?: string;
  equipo?: string;
  ubicacionTecnica?: string;
  yearFrom?: number;
  monthFrom?: number;
  yearTo?: number;
  monthTo?: number;
  sortBy?: 'dueDate' | 'status' | 'abc' | 'frecuencia' | 'psr' | 'centroPlanificacion' | 'hhPlanned' | 'hhActual';
  sortDir?: 'asc' | 'desc';
  groupBy?: 'status' | 'abc' | 'frecuencia' | 'psr' | 'centroPlanificacion';
  take?: number;
}

export interface SavedExecutionView {
  id: string;
  name: string;
  filters: ExecutionViewFilters;
  createdAt: string;
  updatedAt: string;
}

export type WhatsNextBucketId = 'overdue' | 'thisMonth' | 'nextMonth' | 'inTwoMonths';

export interface WhatsNextBucket {
  id: WhatsNextBucketId;
  label: string;
  tone: 'danger' | 'warn' | 'brand' | 'ok';
  count: number;
  totalHh: number;
  abcSplit: { A: number; B: number; C: number; otros: number };
  freqSplit: { key: string; count: number }[];
  rows: ExecutionRow[];
}

export interface WhatsNextResult {
  generatedAt: string;
  thisMonthLabel: string;
  nextMonthLabel: string;
  twoMonthsLabel: string;
  buckets: WhatsNextBucket[];
}

export interface ChartSpec {
  chartType: 'bar' | 'line' | 'area' | 'pie';
  groupBy: 'abc' | 'frecuencia' | 'psr' | 'centroPlanificacion' | 'status' | 'month' | 'year';
  metric: 'count' | 'hhPlanned' | 'hhActual';
  title?: string;
  filter?: Record<string, unknown>;
}

export interface ChartDatum {
  key: string;
  value: number;
  count: number;
}

export interface ChartResponse {
  spec: ChartSpec;
  data: ChartDatum[];
  total: { value: number; count: number };
  _meta: { model: string; latencyMs: number; parser: 'llm' | 'heuristic' };
}
