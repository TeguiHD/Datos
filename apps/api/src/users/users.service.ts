import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { randomToken } from '../common/crypto.util';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private audit: AuditService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        totpEnabled: true,
        mustChangePass: true,
        lastLoginAt: true,
        lockedUntil: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(actorId: string, email: string, role: Role, ctx: { ip: string; userAgent: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email already used');
    const tempPass = randomToken(12);
    const passwordHash = await this.auth.hashPassword(tempPass);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, role, mustChangePass: true },
      select: { id: true, email: true, role: true },
    });
    await this.audit.record({
      userId: actorId,
      action: 'USER_CREATE',
      entity: 'User',
      entityId: user.id,
      after: { email, role },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ...user, temporaryPassword: tempPass };
  }

  async setRole(actorId: string, id: string, role: Role, ctx: { ip: string; userAgent: string }) {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    const after = await this.prisma.user.update({ where: { id }, data: { role } });
    await this.audit.record({
      userId: actorId,
      action: 'USER_ROLE_CHANGE',
      entity: 'User',
      entityId: id,
      before: { role: before.role },
      after: { role: after.role },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { id: after.id, role: after.role };
  }

  async unlock(actorId: string, id: string, ctx: { ip: string; userAgent: string }) {
    await this.prisma.user.update({ where: { id }, data: { lockedUntil: null, failedLogins: 0 } });
    await this.audit.record({
      userId: actorId,
      action: 'USER_UNLOCK',
      entity: 'User',
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }

  async resetTotp(actorId: string, id: string, ctx: { ip: string; userAgent: string }) {
    await this.prisma.user.update({
      where: { id },
      data: { totpEnabled: false, totpSecretEnc: null, backupCodesEnc: null },
    });
    await this.audit.record({
      userId: actorId,
      action: 'USER_TOTP_RESET',
      entity: 'User',
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }
}
