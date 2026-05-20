import { Injectable } from '@nestjs/common';
import { PlantStatus, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePsr } from './sanitize';

type PlantCatalogClient = Prisma.TransactionClient | PrismaService | PrismaClient;

type SeedPlant = {
  name: string;
  aliases: string[];
  status?: PlantStatus;
};

const REVIEW_PLANT = 'POR REVISAR';

const SEED_PLANTS: SeedPlant[] = [
  { name: 'GOODYEAR', aliases: ['GOODYEAR', 'GOOD YEAR', 'PLANTA 009 GOOD YEAR', 'ESZS-90'] },
  { name: 'CAMILO FERRON', aliases: ['CAMILO FERRON', 'CAMILO FERRÓN', 'PLANTA 007 CAMILO FERRON', 'ESZS-70'] },
  { name: 'MYLPAN', aliases: ['MYLPAN', 'MIL PAN', 'PLANTA 008 MYLPAN', 'ESZS-80'] },
  { name: 'EDENSA', aliases: ['EDENSA', 'EDEN S.A.', 'EDEN S.A', 'EDEN SA', 'PLANTA 010 EDEN SA'], status: PlantStatus.STANDBY },
  { name: 'GOLDEN', aliases: ['GOLDEN', 'GOLDEAN CLEAN'], status: PlantStatus.STANDBY },
  { name: 'ALIFRUT', aliases: ['ALIFRUT'], status: PlantStatus.STANDBY },
  { name: 'CCU', aliases: ['CCU', 'CCU COINCO', 'PSR CCU AFTA', 'PLANTA 005 CCU COINCO', 'ESZS-50'] },
  { name: 'CEMIN', aliases: ['CEMIN', 'CEMIN CATEMU', 'PLANTA 012 CEMIN CATEMU', 'ESZS-A1'] },
  { name: 'SIKA', aliases: ['SIKA', 'PLANTA 017 SIKA', 'ESZS-A3'] },
];

@Injectable()
export class PlantCatalogService {
  constructor(private prisma: PrismaService) {}

  ensureSeedCatalog(client: PlantCatalogClient = this.prisma) {
    return ensureSeedCatalog(client);
  }

  async resolveFromLocation(location: string | null | undefined, client: PlantCatalogClient = this.prisma) {
    await ensureSeedCatalog(client);
    return resolvePlantFromLocation(client, location);
  }
}

export function normalizePlantAlias(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/&/g, ' Y ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function ensureSeedCatalog(client: PlantCatalogClient) {
  for (const seed of SEED_PLANTS) {
    const psr = normalizePsr(seed.name);
    const plant = await client.plant.upsert({
      where: { psr },
      update: {},
      create: {
        psr,
        name: seed.name,
        status: seed.status ?? PlantStatus.ACTIVE,
        visibleToViewer: true,
        description: seed.name === REVIEW_PLANT ? 'Candidatos importados que requieren revisión manual.' : undefined,
      },
      select: { id: true },
    });

    for (const alias of [seed.name, ...seed.aliases]) {
      const normalizedAlias = normalizePlantAlias(alias);
      if (!normalizedAlias) continue;
      await client.plantAlias.upsert({
        where: { normalizedAlias },
        update: {
          plantId: plant.id,
          alias,
          source: 'SYSTEM',
        },
        create: {
          plantId: plant.id,
          alias,
          normalizedAlias,
          source: 'SYSTEM',
        },
      });
    }
  }

  await client.plantAlias.deleteMany({
    where: {
      normalizedAlias: normalizePlantAlias('SALA DE CONTROL'),
      plant: { name: REVIEW_PLANT },
    },
  });
}

export async function resolvePlantFromLocation(client: PlantCatalogClient, location: string | null | undefined) {
  const normalizedLocation = normalizePlantAlias(stripTechnicalCode(location));
  const normalizedRawLocation = normalizePlantAlias(location);
  if (!normalizedLocation) return null;

  const aliases = await client.plantAlias.findMany({
    include: { plant: true },
    orderBy: [{ normalizedAlias: 'desc' }],
  });

  const match = aliases
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === 'SYSTEM' ? -1 : 1;
      return b.normalizedAlias.length - a.normalizedAlias.length;
    })
    .find(
      (row) =>
        normalizedLocation === row.normalizedAlias ||
        normalizedLocation.endsWith(` ${row.normalizedAlias}`) ||
        normalizedRawLocation.includes(row.normalizedAlias),
    );

  if (match) return match.plant;

  const candidate = deriveCandidateName(normalizedLocation);
  const plant = await client.plant.upsert({
    where: { psr: normalizePsr(candidate) },
    update: {},
    create: {
      psr: normalizePsr(candidate),
      name: candidate,
      status: PlantStatus.ACTIVE,
      visibleToViewer: true,
      description: 'Candidato derivado automáticamente desde Denominación de la ubicación técnica.',
    },
  });

  await client.plantAlias.upsert({
    where: { normalizedAlias: normalizedLocation },
    update: {},
    create: {
      plantId: plant.id,
      alias: location?.trim() || candidate,
      normalizedAlias: normalizedLocation,
      source: 'EXCEL_CANDIDATE',
    },
  });

  return plant;
}

function stripTechnicalCode(location: string | null | undefined): string {
  return (location ?? '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
}

function deriveCandidateName(normalizedLocation: string): string {
  if (/^CISTERNA\b|^SALA DE CONTROL\b/.test(normalizedLocation)) return REVIEW_PLANT;
  const withoutPrefixes = normalizedLocation
    .replace(/^(SREGULADOR|REGULADOR|REGULADORA|DESCARGA AUXILIAR|SCARGA DE GNL|PURGA|SPURGA|SVAPORIZADOR|VAPORIZADOR|SSOBRECALENTADOR|SOBRECALENTADOR|SMEDICION Y CONSUMO|MEDICION Y CONSUMO|ESTANQUE|TABLERO|SALA DE CONTROL)\s+/, '')
    .trim();
  return withoutPrefixes || REVIEW_PLANT;
}
