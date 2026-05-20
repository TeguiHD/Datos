import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface AuthUser {
  id: string;
  role: Role;
}

@Injectable()
export class OwnsPlantGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      user?: AuthUser;
      params: Record<string, string | undefined>;
    }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('No user');

    const params = req.params;
    const executionId = params.executionId ?? params.id;
    if (!executionId) return true;

    const execution = await this.prisma.operationalExecution.findUnique({
      where: { id: executionId },
      include: { planTask: { include: { plant: true } } },
    });
    if (!execution || execution.planTask.deletedAt || execution.planTask.plant.deletedAt) {
      throw new NotFoundException('Execution not found');
    }

    if (user.role === Role.VIEWER && !execution.planTask.plant.visibleToViewer) {
      throw new NotFoundException('Execution not found');
    }
    return true;
  }
}
