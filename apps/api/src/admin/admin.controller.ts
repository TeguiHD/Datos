import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import 'multer';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators';
import { ImportService } from './import.service';
import { PrismaService } from '../prisma/prisma.service';
import { requestContext } from '../common/request-context';

const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // zip/xlsx
const XLSX_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN)
export class AdminController {
  constructor(
    private imports: ImportService,
    private prisma: PrismaService,
  ) {}

  @Post('import')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('No file');
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) throw new BadRequestException('Must be .xlsx');
    if (!XLSX_MIME.has(file.mimetype)) throw new BadRequestException('Invalid MIME type');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('File too large');
    if (!file.buffer.subarray(0, 4).equals(XLSX_MAGIC)) throw new BadRequestException('Bad magic bytes');
    return this.imports.importFile(user.id, file.originalname, file.buffer, requestContext(req));
  }

  @Get('imports')
  listImports() {
    return this.prisma.importRun.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
