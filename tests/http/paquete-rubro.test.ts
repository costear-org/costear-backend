import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { PAQUETE_CONSTRUCCION_MODULAR } from '@/application/operacion/paquete-construccion-modular.js';

const USER = 'user-1';
const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    company: { findFirst: vi.fn() },
    paqueteRubro: { findMany: vi.fn() },
  },
}));

vi.mock('@/infrastructure/database/prisma.js', () => ({
  prisma: mockPrisma,
  withTenant: async (_userId: string, fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma),
}));
vi.mock('@/infrastructure/http/plugins/authenticate.js', () => ({
  authenticate: async (request: FastifyRequest, _reply: FastifyReply) => {
    (request as FastifyRequest & { authUser: object }).authUser = { id: USER, role: 'EMPRESA_ADMIN', jobTitle: null };
  },
}));

async function buildApp() {
  const Fastify = (await import('fastify')).default;
  const { registerPaqueteRubroRoutes } = await import('@/infrastructure/http/routes/paquete-rubro.routes.js');
  const { errorHandler } = await import('@/infrastructure/http/error-handler.js');
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  await app.register(registerPaqueteRubroRoutes);
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.company.findFirst.mockResolvedValue({ id: COMPANY_ID, userId: USER, industry: 'CONSTRUCCION_MODULAR' });
  mockPrisma.paqueteRubro.findMany.mockResolvedValue([{
    category: 'CONSTRUCCION_MODULAR', userId: null, companyId: null, structureId: null, periodId: null,
    ...PAQUETE_CONSTRUCCION_MODULAR, scale: null,
  }]);
});

describe('paquete de rubro — contrato HTTP de #498', () => {
  it('200 — publica el léxico resuelto de Construcción Modular sin requerir un período', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: `/companies/${COMPANY_ID}/paquete-rubro` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        category: 'CONSTRUCCION_MODULAR',
        lexicon: expect.objectContaining({ OrdenTrabajo: 'Obra', EtapaOrden: 'Etapa', PlantillaOrden: 'Modelo' }),
      },
    });
  });

  it('200 — refleja el override de empresa y omite claves ausentes sin inventar un fallback', async () => {
    mockPrisma.paqueteRubro.findMany.mockResolvedValue([{
      category: 'CONSTRUCCION_MODULAR', userId: USER, companyId: COMPANY_ID, structureId: null, periodId: null,
      ...PAQUETE_CONSTRUCCION_MODULAR,
      lexicon: { OrdenTrabajo: 'Proyecto', EtapaOrden: 'Fase' },
      scale: null,
    }]);
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: `/companies/${COMPANY_ID}/paquete-rubro` });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.lexicon).toEqual({ OrdenTrabajo: 'Proyecto', EtapaOrden: 'Fase' });
    expect(response.json().data.lexicon).not.toHaveProperty('PlantillaOrden');
  });
});
