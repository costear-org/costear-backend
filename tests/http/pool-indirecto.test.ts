import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';

const USER = '11111111-1111-1111-1111-111111111111'; const POOL = '22222222-2222-2222-2222-222222222222'; const ORDER = '33333333-3333-3333-3333-333333333333';
const { db } = vi.hoisted(() => ({ db: {
  company: { findFirst: vi.fn() }, poolIndirecto: { findFirst: vi.fn(), create: vi.fn() }, costoRealPool: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  ordenTrabajo: { findMany: vi.fn() }, corridaAsignacionPool: { create: vi.fn(), findMany: vi.fn() }, traceAuditLog: { create: vi.fn() },
} }));
vi.mock('@/infrastructure/database/prisma.js', () => ({ prisma: db, withTenant: async (_id: string, fn: (tx: typeof db) => unknown) => fn(db) }));
vi.mock('@/infrastructure/http/plugins/authenticate.js', () => ({ authenticate: async (request: FastifyRequest, _reply: FastifyReply) => { request.authUser = { id: USER, tenantId: USER, role: 'EMPRESA_ADMIN', jobTitle: null }; } }));

async function app() { const Fastify = (await import('fastify')).default; const { registerPoolIndirectoRoutes } = await import('@/infrastructure/http/routes/pool-indirecto.routes.js'); const { errorHandler } = await import('@/infrastructure/http/error-handler.js'); const instance = Fastify({ logger: false }); instance.setErrorHandler(errorHandler); await instance.register(registerPoolIndirectoRoutes); return instance; }

beforeEach(() => { vi.clearAllMocks(); db.poolIndirecto.findFirst.mockResolvedValue({ id: POOL, companyId: USER, userId: USER, nombre: 'Taller', periodo: '2026-09', presupuestoFijo: 1_500_000, presupuestoVariable: 500_000, capacidadNormal: 1_000 }); db.ordenTrabajo.findMany.mockResolvedValue([{ id: ORDER }]); db.costoRealPool.findMany.mockResolvedValue([]); });

describe('contrato HTTP de pools indirectos', () => {
  it('rechaza naturaleza ausente o importe no numérico con 400', async () => {
    const api = await app(); const response = await api.inject({ method: 'POST', url: `/pools-indirectos/${POOL}/costos-reales`, payload: { periodo: '2026-09', concepto: 'energía', importe: 'mucho', origen: 'factura' } });
    expect(response.statusCode).toBe(400); expect(db.costoRealPool.create).not.toHaveBeenCalled();
  });
  it('rechaza la corrida sin CIF real con 422 accionable', async () => {
    const api = await app(); const response = await api.inject({ method: 'POST', url: `/pools-indirectos/${POOL}/corridas`, payload: { periodo: '2026-09', aplicaciones: [{ ordenId: ORDER, cantidadBase: 900 }] } });
    expect(response.statusCode).toBe(422); expect(response.json().error.message).toContain('Sin CIF real cargado para 2026-09');
  });
});
