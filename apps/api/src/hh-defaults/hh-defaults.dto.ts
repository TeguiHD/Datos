import { IsEnum, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export const SCOPES = [
  'GLOBAL',
  'ABC',
  'FREQ',
  'FREQ_ABC',
  'PLANT',
  'PLANT_FREQ',
  'PLANT_FREQ_ABC',
] as const;
export type HhDefaultScope = (typeof SCOPES)[number];

export class UpsertHhDefaultDto {
  @IsEnum(SCOPES)
  scope!: HhDefaultScope;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  plantId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  frecuenciaCodigo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 4)
  abc?: string;

  @IsNumber()
  @Min(0)
  @Max(99999)
  hhPlan!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  priority?: number;

  @IsOptional()
  @IsString()
  @Length(0, 512)
  note?: string;
}
