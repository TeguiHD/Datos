import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decrypt, encrypt, randomToken, sha256 } from '../common/crypto.util';

const LOCKOUT_STEPS = [
  { threshold: 5, minutes: 15 },
  { threshold: 10, minutes: 60 },
  { threshold: 20, minutes: 60 * 24 * 365 }, // effectively requires manual reset
];

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;
const TRUSTED_DEVICE_TTL_SEC = 7 * 24 * 60 * 60;

interface TrustedDevicePayload {
  sub: string;
  typ: 'tfa_trust';
  ua: string;
  ts: string;
}

export interface AuthContext {
  ip: string;
  userAgent: string;
}

@Injectable()
export class AuthService {
  private dummyPasswordHashPromise: Promise<string> | null = null;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async dummyPasswordHash(): Promise<string> {
    if (!this.dummyPasswordHashPromise) {
      // Uses same Argon2 settings to reduce observable timing differences for unknown users.
      this.dummyPasswordHashPromise = argon2.hash('dummy-login-password-' + this.pepper(), this.argonOpts());
    }
    return this.dummyPasswordHashPromise;
  }

  private pepper(): string {
    const p = process.env.PASSWORD_PEPPER;
    if (!p) throw new Error('PASSWORD_PEPPER not set');
    return p;
  }

  private argonOpts() {
    return {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    } as const;
  }

  async hashPassword(plain: string) {
    return argon2.hash(plain + this.pepper(), this.argonOpts());
  }

  async verifyPassword(hash: string, plain: string) {
    return argon2.verify(hash, plain + this.pepper());
  }

  async login(email: string, password: string, ctx: AuthContext) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    // Constant-time-ish: always compute a hash verify
    const hash = user?.passwordHash ?? (await this.dummyPasswordHash());
    let ok = false;
    try {
      ok = await argon2.verify(hash, password + this.pepper());
    } catch {
      ok = false;
    }

    if (!user || !ok) {
      if (user) await this.registerFailure(user, ctx);
      await this.audit.record({
        userId: user?.id,
        action: 'LOGIN_FAIL',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account locked');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });

    return user;
  }

  private async registerFailure(user: User, ctx: AuthContext) {
    const failed = user.failedLogins + 1;
    let lockedUntil: Date | null = user.lockedUntil;
    for (const step of LOCKOUT_STEPS) {
      if (failed >= step.threshold) lockedUntil = new Date(Date.now() + step.minutes * 60_000);
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: failed, lockedUntil },
    });
    if (lockedUntil && lockedUntil !== user.lockedUntil) {
      await this.audit.record({
        userId: user.id,
        action: 'ACCOUNT_LOCKED',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        after: { until: lockedUntil.toISOString(), failed },
      });
    }
  }

  async enrollTotpStart(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabled) throw new BadRequestException('TOTP already enabled');

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'datos.nicoholas.dev',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });
    const uri = totp.toString();
    const qr = await QRCode.toDataURL(uri);

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecretEnc: encrypt(secret.base32) },
    });

    return { qr, uri };
  }

  async enrollTotpConfirm(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpSecretEnc) throw new BadRequestException('Enrollment not started');

    const secret = decrypt(user.totpSecretEnc);
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 });
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) throw new UnauthorizedException('Invalid TOTP');

    const backupCodes = Array.from({ length: 10 }, () => randomToken(6));
    const hashedCodes = await Promise.all(backupCodes.map((c) => argon2.hash(c, this.argonOpts())));

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: true,
        backupCodesEnc: encrypt(JSON.stringify(hashedCodes)),
      },
    });

    return { backupCodes };
  }

  async verifyTotp(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpEnabled || !user.totpSecretEnc) throw new UnauthorizedException('TOTP not enrolled');

    const secret = decrypt(user.totpSecretEnc);
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 });
    const delta = totp.validate({ token: code, window: 1 });
    if (delta !== null) return true;

    // Backup code fallback
    if (user.backupCodesEnc) {
      const hashes: string[] = JSON.parse(decrypt(user.backupCodesEnc));
      for (let i = 0; i < hashes.length; i++) {
        try {
          if (await argon2.verify(hashes[i]!, code)) {
            hashes.splice(i, 1);
            await this.prisma.user.update({
              where: { id: userId },
              data: { backupCodesEnc: encrypt(JSON.stringify(hashes)) },
            });
            return true;
          }
        } catch {
          /* ignore */
        }
      }
    }

    throw new UnauthorizedException('Invalid TOTP');
  }

  private trustedStateHash(user: Pick<User, 'totpSecretEnc'>): string {
    // Invalidates trusted-device cookies whenever TOTP enrollment secret changes.
    return sha256(user.totpSecretEnc ?? 'none');
  }

  async issueTrustedDeviceToken(user: Pick<User, 'id' | 'totpSecretEnc'>, ctx: AuthContext) {
    return this.jwt.signAsync(
      {
        sub: user.id,
        typ: 'tfa_trust',
        ua: sha256(ctx.userAgent),
        ts: this.trustedStateHash(user),
      },
      { expiresIn: TRUSTED_DEVICE_TTL_SEC },
    );
  }

  async isTrustedDeviceTokenValid(user: Pick<User, 'id' | 'totpSecretEnc'>, token: string, ctx: AuthContext) {
    try {
      const payload = await this.jwt.verifyAsync<TrustedDevicePayload>(token);
      return (
        payload.typ === 'tfa_trust' &&
        payload.sub === user.id &&
        payload.ua === sha256(ctx.userAgent) &&
        payload.ts === this.trustedStateHash(user)
      );
    } catch {
      return false;
    }
  }

  async issueTokens(user: User, tfa: boolean, ctx: AuthContext) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, tfa },
      { expiresIn: ACCESS_TTL_SEC },
    );

    const refreshToken = randomToken(48);
    const refreshHash = sha256(refreshToken);
    const familyId = randomToken(16);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshHash,
        familyId,
        tfaVerified: tfa,
        userAgent: ctx.userAgent.slice(0, 512),
        ip: ctx.ip,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, expiresAt };
  }

  async rotateRefresh(oldToken: string, ctx: AuthContext) {
    const hash = sha256(oldToken);
    const session = await this.prisma.session.findUnique({ where: { refreshHash: hash } });
    if (!session) throw new UnauthorizedException('Invalid refresh');

    if (session.revokedAt) {
      // Reuse detected — revoke whole family
      await this.prisma.session.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        userId: session.userId,
        action: 'REFRESH_REUSE_DETECTED',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('Refresh token reuse');
    }

    if (session.expiresAt < new Date()) throw new UnauthorizedException('Refresh expired');

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
    const newRefresh = randomToken(48);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshHash: sha256(newRefresh),
        familyId: session.familyId,
        tfaVerified: session.tfaVerified,
        userAgent: ctx.userAgent.slice(0, 512),
        ip: ctx.ip,
        expiresAt,
      },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, tfa: session.tfaVerified },
      { expiresIn: ACCESS_TTL_SEC },
    );

    return { accessToken, refreshToken: newRefresh, expiresAt };
  }

  async revokeRefresh(token: string) {
    const hash = sha256(token);
    await this.prisma.session
      .update({ where: { refreshHash: hash }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  accessTtl() {
    return ACCESS_TTL_SEC;
  }

  trustedDeviceTtl() {
    return TRUSTED_DEVICE_TTL_SEC;
  }

  refreshTtl() {
    return REFRESH_TTL_SEC;
  }
}
