import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class MonthlyReportDto {
  @IsInt()
  @Min(2020)
  @Max(2099)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsOptional()
  @IsString()
  plantId?: string;
}
