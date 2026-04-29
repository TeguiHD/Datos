import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto, EnrollTotpConfirmDto, LoginDto, VerifyTotpDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { generateCsrfToken } from '../common/csrf';
import { requestContext } from '../common/request-context';

const TRUSTED_2FA_COOKIE = 'trusted_2fa_device';

function cookieOpts(maxAgeSec: number) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: maxAgeSec * 1000,
  };
}

function clearCookieOpts() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict' as const,
    path: '/',
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ctx = requestContext(req);
    const user = await this.auth.login(dto.email, dto.password, ctx);

    const trustedCookie = req.cookies?.[TRUSTED_2FA_COOKIE];
    const trustedDevice =
      user.totpEnabled && trustedCookie
        ? await this.auth.isTrustedDeviceTokenValid(user, trustedCookie, ctx)
        : false;

    if (user.totpEnabled && trustedCookie && !trustedDevice) {
      res.clearCookie(TRUSTED_2FA_COOKIE, clearCookieOpts());
    }

    const requiresTotpEnroll = !user.totpEnabled;
    const requiresTotp = user.totpEnabled && !trustedDevice;
    const tfaVerified = user.totpEnabled && trustedDevice;

    // Only trusted devices for users with TOTP enabled can skip second factor.
    const { accessToken, refreshToken } = await this.auth.issueTokens(user, tfaVerified, ctx);
    res.cookie('access_token', accessToken, cookieOpts(this.auth.accessTtl()));
    res.cookie('refresh_token', refreshToken, cookieOpts(this.auth.refreshTtl()));

    await this.audit.record({
      userId: user.id,
      action: 'LOGIN_OK',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return {
      requiresTotpEnroll,
      requiresTotp,
      mustChangePass: user.mustChangePass,
    };
  }

  @Get('csrf')
  @HttpCode(200)
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return { token: generateCsrfToken(req, res) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('totp/enroll/start')
  async enrollStart(@CurrentUser() user: { id: string }) {
    return this.auth.enrollTotpStart(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('totp/enroll/confirm')
  async enrollConfirm(@CurrentUser() user: { id: string }, @Body() dto: EnrollTotpConfirmDto) {
    return this.auth.enrollTotpConfirm(user.id, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  @Post('totp/verify')
  async verifyTotp(
    @CurrentUser() user: { id: string },
    @Body() dto: VerifyTotpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = requestContext(req);
    try {
      await this.auth.verifyTotp(user.id, dto.code);
    } catch (e) {
      await this.audit.record({
        userId: user.id,
        action: 'TOTP_VERIFY_FAIL',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        after: { codeLen: dto.code.length, rememberDevice: !!dto.rememberDevice },
      });
      throw e;
    }

    const full = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const { accessToken, refreshToken } = await this.auth.issueTokens(full, true, ctx);
    res.cookie('access_token', accessToken, cookieOpts(this.auth.accessTtl()));
    res.cookie('refresh_token', refreshToken, cookieOpts(this.auth.refreshTtl()));

    if (dto.rememberDevice) {
      const trustedToken = await this.auth.issueTrustedDeviceToken(full, ctx);
      res.cookie(TRUSTED_2FA_COOKIE, trustedToken, cookieOpts(this.auth.trustedDeviceTtl()));
    } else {
      res.clearCookie(TRUSTED_2FA_COOKIE, clearCookieOpts());
    }

    await this.auth.revokeRefresh(req.cookies?.['refresh_token'] ?? '');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ctx.ip },
    });

    await this.audit.record({
      userId: user.id,
      action: 'TOTP_VERIFY_OK',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      after: { rememberDevice: !!dto.rememberDevice },
    });

    return { ok: true };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rt = req.cookies?.['refresh_token'];
    if (!rt) throw new UnauthorizedException();
    const ctx = requestContext(req);
    const { accessToken, refreshToken } = await this.auth.rotateRefresh(rt, ctx);
    res.cookie('access_token', accessToken, cookieOpts(this.auth.accessTtl()));
    res.cookie('refresh_token', refreshToken, cookieOpts(this.auth.refreshTtl()));
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('trusted-device/forget')
  @HttpCode(200)
  async forgetTrustedDevice(
    @CurrentUser() user: { id: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie(TRUSTED_2FA_COOKIE, clearCookieOpts());
    const ctx = requestContext(req);
    await this.audit.record({
      userId: user.id,
      action: 'TRUSTED_DEVICE_FORGOT',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rt = req.cookies?.['refresh_token'];
    if (rt) await this.auth.revokeRefresh(rt);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.clearCookie(TRUSTED_2FA_COOKIE, clearCookieOpts());
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: { id: string; email: string; role: string; tfa: boolean }) {
    const full = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        role: true,
        totpEnabled: true,
        mustChangePass: true,
        lastLoginAt: true,
      },
    });
    return { ...full, tfa: user.tfa };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const full = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const ok = await this.auth.verifyPassword(full.passwordHash, dto.currentPassword);
    if (!ok) throw new UnauthorizedException('Current password invalid');
    const newHash = await this.auth.hashPassword(dto.newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustChangePass: false },
    });
    const ctx = requestContext(req);
    await this.audit.record({ userId: user.id, action: 'PASSWORD_CHANGED', ip: ctx.ip, userAgent: ctx.userAgent });
    // Revoke all sessions as a safety net
    await this.prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
