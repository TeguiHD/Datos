import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

type SeedAdmin = {
  email: string;
  password: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readSeedAdmins(): SeedAdmin[] {
  const admins: SeedAdmin[] = [];

  const email1 = process.env.SEED_SUPERADMIN_EMAIL?.trim();
  const pass1 = process.env.SEED_SUPERADMIN_PASSWORD;
  if (email1 || pass1) {
    if (!email1 || !pass1) {
      throw new Error('Missing SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD');
    }
    admins.push({ email: normalizeEmail(email1), password: pass1 });
  }

  const email2 = process.env.SEED_SUPERADMIN_EMAIL_2?.trim();
  const pass2 = process.env.SEED_SUPERADMIN_PASSWORD_2;
  if (email2 || pass2) {
    if (!email2 || !pass2) {
      throw new Error('Missing SEED_SUPERADMIN_EMAIL_2 / SEED_SUPERADMIN_PASSWORD_2');
    }
    admins.push({ email: normalizeEmail(email2), password: pass2 });
  }

  const unique = new Set<string>();
  for (const admin of admins) {
    if (unique.has(admin.email)) {
      throw new Error(`Duplicate superadmin email in seed env: ${admin.email}`);
    }
    unique.add(admin.email);
  }

  if (admins.length === 0) {
    throw new Error(
      'Missing seed admins. Set SEED_SUPERADMIN_EMAIL/SEED_SUPERADMIN_PASSWORD and SEED_SUPERADMIN_EMAIL_2/SEED_SUPERADMIN_PASSWORD_2',
    );
  }

  return admins;
}

async function main() {
  const admins = readSeedAdmins();
  const pepper = process.env.PASSWORD_PEPPER;

  if (!pepper) {
    throw new Error('Missing PASSWORD_PEPPER');
  }

  for (const admin of admins) {
    const passwordHash = await argon2.hash(admin.password + pepper, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const existing = await prisma.user.findUnique({
      where: { email: admin.email },
      select: { id: true, email: true, mustChangePass: true },
    });

    if (!existing) {
      const created = await prisma.user.create({
        data: {
          email: admin.email,
          passwordHash,
          role: Role.SUPERADMIN,
          mustChangePass: true,
        },
      });
      console.log(`[seed] created superadmin ${created.email} id=${created.id} (mustChangePass=true)`);
      continue;
    }

    const shouldRefreshBootstrapPassword = existing.mustChangePass;
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: shouldRefreshBootstrapPassword
        ? {
            role: Role.SUPERADMIN,
            passwordHash,
            mustChangePass: true,
          }
        : {
            role: Role.SUPERADMIN,
          },
    });

    console.log(
      `[seed] updated superadmin ${updated.email} id=${updated.id} (refreshedPassword=${shouldRefreshBootstrapPassword})`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
