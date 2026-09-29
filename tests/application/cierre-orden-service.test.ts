import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER = '11111111-1111-1111-1111-111111111111';
const ORDER = '44444444-4444-4444-4444-444444444444';
const actor = { id: USER, role: 'EMPRESA_ADMIN', area: 'costista', method: 'manual' };

const { db, recordTraceAudit } = vi.hoisted(() => ({
  db: {
    ordenTrabajo: { findFirst: vi.fn(), update: vi.fn() },
    fotoCierreOrden: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    traceAuditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
  },
  recordTraceAudit: vi.fn(async () => undefined),
}));

vi.mock('@/infrastructure/database/prisma.js', () => ({
  prisma: db,
  withTenant: async (_id: string, fn: (tx: typeof db) => unknown) => fn(db),
}));
vi.mock('@/application/audit/trace-audit.js', () => ({ recordTraceAudit }));
vi.mock('@/application/ordenes/informe-desvio-orden-service.js', () => ({
  InformeDesvioOrdenService: class { async get() { return { costoPresupuestado: 100, costoReal: 120, precioContractual: 160, margenEsperado: 60, margenReal: 40, elementos: [], puente: [] }; } },
}));

describe('CierreOrdenService', () => {
  beforeEach(() => { vi.clearAllMocks(); db.fotoCierreOrden.findFirst.mockResolvedValue(null); });

  it('test 21 — bloquea el cierre y nombra un parte sin aprobar', async () => {
    const { CierreOrdenService } = await import('@/application/ordenes/cierre-orden-service.js');
    db.ordenTrabajo.findFirst.mockResolvedValue({
      id: ORDER, userId: USER, estado: 'PENDIENTE_CIERRE', presupuestos: [],
      partesHoras: [{ id: 'parte-1', estado: 'CARGADO' }], costosDirectos: [], contingencias: [],
    });
    await expect(new CierreOrdenService(db as never).close(USER, ORDER, actor))
      .rejects.toMatchObject({ statusCode: 422, code: 'ORDER_CLOSE_PENDING_ITEMS', details: { pendientes: [{ tipo: 'PARTE_HORAS', id: 'parte-1' }] } });
    expect(db.fotoCierreOrden.create).not.toHaveBeenCalled();
  });

  it('rechaza reabrir sin motivo', async () => {
    const { CierreOrdenService } = await import('@/application/ordenes/cierre-orden-service.js');
    await expect(new CierreOrdenService(db as never).reopen(USER, ORDER, { motivo: ' ' }, actor))
      .rejects.toMatchObject({ statusCode: 400, code: 'REOPEN_REASON_REQUIRED' });
  });
});
