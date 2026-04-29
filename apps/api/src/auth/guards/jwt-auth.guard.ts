import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) throw err instanceof Error ? err : new UnauthorizedException();
    return user;
  }

  override canActivate(ctx: ExecutionContext) {
    return super.canActivate(ctx);
  }
}
