import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListTasksDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() psr?: string;
  @IsOptional() @IsString() abc?: string;
  @IsOptional() @IsString() frecuencia?: string;
  @IsOptional() @IsString() centroPlanificacion?: string;
  @IsOptional() @IsString() equipo?: string;
  @IsOptional() @IsString() ubicacionTecnica?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) month?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) take?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number;
}

export class UpsertTaskDto {
  @IsOptional() @IsString() andamios?: string;
  @IsOptional() @IsString() materiales?: string;
  @IsOptional() @IsString() comentarios?: string;
  @IsOptional() @IsString() psr?: string;
  @IsOptional() @IsString() centroPlanificacion?: string;
  @IsOptional() @IsString() claseActividadPm?: string;
  @IsOptional() @IsString() claseOrden?: string;
  @IsOptional() @IsString() campoClasificacion?: string;
  @IsOptional() @IsString() planMantPreventivo?: string;
  @IsOptional() @IsString() estrategiaMantenim?: string;
  @IsOptional() @IsString() descPosicionMant?: string;
  @IsOptional() @IsString() ultimaOrden?: string;
  @IsOptional() @IsString() indicadorAbc?: string;
  @IsOptional() @IsString() ubicacionTecnica?: string;
  @IsOptional() @IsString() denomUbicacionTecnica?: string;
  @IsOptional() @IsString() posicionMant?: string;
  @IsOptional() @IsString() ptoTbjoResponsable?: string;
  @IsOptional() @IsString() equipo?: string;
  @IsOptional() @IsString() denomObjetoTecnico?: string;
  @IsOptional() @IsString() tipoHojaRuta?: string;
  @IsOptional() @IsString() grupoHojasRuta?: string;
  @IsOptional() @IsString() contGrupoHRuta?: string;
  @IsOptional() @IsString() hojaRuta?: string;
  @IsOptional() @IsString() claveModelo?: string;
  @IsOptional() @IsString() frecuenciaCodigo?: string;
  @IsOptional() @Type(() => Number) hhReal?: number;
  @IsOptional() @Type(() => Number) @IsInt() frecuenciaMeses?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) mesInicio?: number;
}

export class UpsertScheduleDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
  @Type(() => Number) hh!: number;
}
