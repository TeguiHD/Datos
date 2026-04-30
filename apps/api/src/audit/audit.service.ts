import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const AUDIT_CHAIN_LOCK_ID = 1_917_304_017;

export interface AuditInput {
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip: string;
  userAgent: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async record(input: AuditInput) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_CHAIN_LOCK_ID})`;
        const last = await tx.auditLog.findFirst({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
        const prevHash = last?.hash ?? 'GENESIS';
        const payload = JSON.stringify({
          userId: input.userId ?? null,
          action: input.action,
          entity: input.entity ?? null,
          entityId: input.entityId ?? null,
          before: input.before ?? null,
          after: input.after ?? null,
          ip: input.ip,
          userAgent: input.userAgent,
          prevHash,
          ts: new Date().toISOString(),
        });
        const hash = createHash('sha256').update(payload).digest('hex');
        return tx.auditLog.create({
          data: {
            userId: input.userId ?? null,
            action: input.action,
            entity: input.entity,
            entityId: input.entityId,
            before: (input.before ?? null) as never,
            after: (input.after ?? null) as never,
            ip: input.ip,
            userAgent: input.userAgent,
            prevHash,
            hash,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async verifyChain() {
    const logs = await this.prisma.auditLog.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    let prevHash = 'GENESIS';
    for (const log of logs) {
      if (log.prevHash !== prevHash) return { ok: false, brokenAt: log.id };
      prevHash = log.hash;
    }
    return { ok: true, count: logs.length };
  }

  list(params: { take?: number; skip?: number; userId?: string; action?: string }) {
    const { take = 100, skip = 0, userId, action } = params;
    return this.prisma.auditLog.findMany({
      take: Math.min(take, 500),
      skip,
      where: { userId, action },
      orderBy: { createdAt: 'desc' },
    });
  }
}
