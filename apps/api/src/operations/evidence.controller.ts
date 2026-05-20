import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { requestContext } from '../common/request-context';
import { EvidenceDescriptionDto } from './operations.dto';
import { EvidenceService } from './evidence.service';

const MAX_UPLOAD_BYTES = Number(process.env.EVIDENCE_MAX_FILE_MB ?? 25) * 1024 * 1024;

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR, Role.VIEWER)
@Controller()
export class EvidenceController {
  constructor(private evidence: EvidenceService) {}

  @Post('ejecuciones/:id/evidencias')
  @Roles(Role.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(
    @CurrentUser() user: { id: string },
    @Param('id') executionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: EvidenceDescriptionDto,
    @Req() req: Request,
  ) {
    return this.evidence.upload(user.id, executionId, file, body, requestContext(req));
  }

  @Post('tareas/ejecuciones/:id/evidencias')
  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.EDITOR)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  uploadToTask(
    @CurrentUser() user: { id: string },
    @Param('id') taskExecutionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: EvidenceDescriptionDto,
    @Req() req: Request,
  ) {
    return this.evidence.uploadToTaskExecution(user.id, taskExecutionId, file, body, requestContext(req));
  }

  @Get('evidencias/:id')
  @Header('Cache-Control', 'private, no-store')
  async download(@CurrentUser() user: { role: Role }, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { stream, evidence } = await this.evidence.openForDownload(user, id);
    res.setHeader('Content-Type', evidence.mime);
    res.setHeader('Content-Length', String(evidence.sizeBytes));
    res.setHeader('Content-Disposition', `attachment; filename="${evidence.originalName ?? evidence.filename}"`);
    return new StreamableFile(stream);
  }

  @Delete('evidencias/:id')
  @Roles(Role.SUPERADMIN)
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: Request) {
    return this.evidence.remove(user.id, id, requestContext(req));
  }
}
