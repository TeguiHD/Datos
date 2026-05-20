import { Type } from 'class-transformer';
import { ExecStatus } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export const EXECUTION_SORT_FIELDS = [
  'dueDate',
  'status',
  'hhPlanned',
  'hhActual',
  'abc',
  'frecuencia',
  'psr',
  'centroPlanificacion',
] as const;

export type ExecutionSortField = (typeof EXECUTION_SORT_FIELDS)[number];

export const EXECUTION_GROUP_FIELDS = [
  'status',
  'abc',
  'frecuencia',
  'psr',
  'centroPlanificacion',
] as const;

export const EXECUTION_EXPORT_FORMATS = ['csv', 'xlsx'] as const;
export const PLANT_SORT_FIELDS = ['risk', 'hh', 'overdue', 'name', 'nextDueDate'] as const;

export type ExecutionGroupField = (typeof EXECUTION_GROUP_FIELDS)[number];
export type ExecutionExportFormat = (typeof EXECUTION_EXPORT_FORMATS)[number];
export type PlantSortField = (typeof PLANT_SORT_FIELDS)[number];

export class UpcomingDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days?: number;
}

export class HeatmapDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) from!: number;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) to!: number;
  @IsOptional() @IsString() plantId?: string;
  @IsOptional() @IsString() planta?: string;
}

export class MonthlyDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
}

export class YearDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year!: number;
}

export class MatrixDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) yearFrom!: number;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) yearTo!: number;
  @IsOptional() @IsString() plantId?: string;
  @IsOptional() @IsString() q?: string;
}

export class ExecutionFiltersBaseDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() plantId?: string;
  @IsOptional() @IsString() planta?: string;
  @IsOptional() @IsEnum(ExecStatus) status?: ExecStatus;
  @IsOptional() @IsString() abc?: string;
  @IsOptional() @IsString() frecuencia?: string;
  @IsOptional() @IsString() psr?: string;
  @IsOptional() @IsString() centroPlanificacion?: string;
  @IsOptional() @IsString() equipo?: string;
  @IsOptional() @IsString() ubicacionTecnica?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) yearFrom?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) monthFrom?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) yearTo?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) monthTo?: number;
}

export class ListExecutionsDto extends ExecutionFiltersBaseDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) take?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number;
  @IsOptional() @IsIn(EXECUTION_SORT_FIELDS) sortBy?: ExecutionSortField;
  @IsOptional() @IsIn(['asc', 'desc']) sortDir?: 'asc' | 'desc';
}

export class GroupExecutionsDto extends ExecutionFiltersBaseDto {
  @IsIn(EXECUTION_GROUP_FIELDS) groupBy!: ExecutionGroupField;
}

export class PipelineDto extends ExecutionFiltersBaseDto {}

export class PlantListDto extends ExecutionFiltersBaseDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) take?: number;
  @IsOptional() @IsIn(PLANT_SORT_FIELDS) sortBy?: PlantSortField;
}

class SavedViewParamsDto extends ExecutionFiltersBaseDto {
  @IsOptional() @IsIn(EXECUTION_SORT_FIELDS) sortBy?: ExecutionSortField;
  @IsOptional() @IsIn(['asc', 'desc']) sortDir?: 'asc' | 'desc';
  @IsOptional() @IsIn(EXECUTION_GROUP_FIELDS) groupBy?: ExecutionGroupField;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) take?: number;
}

export class ExportExecutionsDto extends ExecutionFiltersBaseDto {
  @IsOptional() @IsIn(EXECUTION_SORT_FIELDS) sortBy?: ExecutionSortField;
  @IsOptional() @IsIn(['asc', 'desc']) sortDir?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5000) take?: number;
  @IsOptional() @IsIn(EXECUTION_EXPORT_FORMATS) format?: ExecutionExportFormat;
}

export class CreateSavedViewDto extends SavedViewParamsDto {
  @IsString() @Length(1, 80) name!: string;
}

export class UpdateSavedViewDto extends SavedViewParamsDto {
  @IsOptional() @IsString() @Length(1, 80) name?: string;
}

export class UpdateExecutionDto {
  @IsOptional() @IsEnum(ExecStatus) status?: ExecStatus;
  @IsOptional() @IsISO8601() dueDate?: string;
  @IsOptional() @Type(() => Number) hhPlanned?: number;
  @IsOptional() @Type(() => Number) hhActual?: number;
  @IsOptional() @IsISO8601() doneDate?: string;
  @IsOptional() @IsString() @Length(1, 128) operator?: string;
  @IsOptional() @IsString() @Length(0, 1024) notes?: string;
}
