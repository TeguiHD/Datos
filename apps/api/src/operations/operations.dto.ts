import { Type } from 'class-transformer';
import { EquipmentType, PlanFrequency, PlantStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class ListPlantsDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(PlantStatus) status?: PlantStatus;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) take?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number;
}

export class UpsertPlantDto {
  @IsString() @Length(1, 80) psr!: string;
  @IsString() @Length(1, 120) name!: string;
  @IsOptional() @IsString() @Length(0, 1000) description?: string;
  @IsOptional() @IsString() @Length(0, 80) area?: string;
  @IsOptional() @IsString() @Length(0, 32) color?: string;
  @IsOptional() @IsEnum(PlantStatus) status?: PlantStatus;
  @IsOptional() @IsBoolean() visibleToViewer?: boolean;
}

export class UpdatePlantDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsString() @Length(0, 1000) description?: string;
  @IsOptional() @IsString() @Length(0, 80) area?: string;
  @IsOptional() @IsString() @Length(0, 32) color?: string;
  @IsOptional() @IsEnum(PlantStatus) status?: PlantStatus;
  @IsOptional() @IsBoolean() visibleToViewer?: boolean;
  @IsOptional() @IsString() @Length(0, 500) inactiveReason?: string;
}

export class DeletePlantDto {
  @IsOptional() @IsString() @Length(0, 500) reason?: string;
}

export class UpsertEquipmentDto {
  @IsOptional() @IsEnum(EquipmentType) type?: EquipmentType;
  @IsString() @Length(1, 120) name!: string;
  @IsOptional() @IsString() @Length(0, 120) model?: string;
  @IsOptional() @IsString() @Length(0, 120) serial?: string;
  @IsOptional() @IsString() @Length(0, 1000) notes?: string;
}

export class UpsertPlanTaskDto {
  @IsOptional() @IsString() equipmentId?: string;
  @IsOptional() @IsString() @Length(0, 1) abc?: string;
  @IsString() @Length(1, 240) description!: string;
  @IsEnum(PlanFrequency) frequency!: PlanFrequency;
  @IsOptional() @IsString() @Length(0, 120) cronExpression?: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(10000) hhPlan!: number;
  @IsOptional() @IsString() responsibleId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class GenerateExecutionsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(84) months?: number;
}
