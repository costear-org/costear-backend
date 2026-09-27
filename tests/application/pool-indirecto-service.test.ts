import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PoolIndirectoService } from '@/application/ordenes/pool-indirecto-service.js';

const USER = '11111111-1111-1111-1111-111111111111';
const POOL = '22222222-2222-2222-2222-222222222222';
const ORDER = '33333333-3333-3333-3333-333333333333';
const ORDER_2 = '77777777-7777-7777-7777-777777777777';
const actor = { id: USER, role: 'EMPRESA_ADMIN', area: 'costista' };
const { db } = vi.hoisted(() => ({ db: {
  poolIndirecto: { findFirst: vi.fn(), create: vi.fn() }, costoRealPool: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  ordenTrabajo: { findMany: vi.fn() }, corridaAsignacionPool: { create: vi.fn(), findMany: vi.fn() }, traceAuditLog: { create: vi.fn() },
} }));
vi.mock('@/infrastructure/database/prisma.js', () => ({ prisma: db, withTenant: async (_id: string, fn: (tx: typeof db) => unknown) => fn(db) }));

const pool = { id: POOL, companyId: USER, userId: USER, nombre: 'Taller', tipo: 'FABRIL', base: 'HORAS_HOMBRE', periodo: '2026-09', presupuestoFijo: 1_500_000, presupuestoVariable: 500_000, capacidadNormal: 1_000 };
const actuals = [
  { id: '44444444-4444-4444-4444-444444444444', poolId: POOL, userId: USER, periodo: '2026-09', concepto: 'estructura', naturaleza: 'FIJO', importe: 1_500_000, reemplazaAId: null, createdAt: new Date() },
  { id: '55555555-5555-5555-5555-555555555555', poolId: POOL, userId: USER, periodo: '2026-09', concepto: 'consumibles', naturaleza: 'VARIABLE', importe: 495_000, reemplazaAId: null, createdAt: new Date() },
];

beforeEach(() => {
  vi.clearAllMocks(); db.poolIndirecto.findFirst.mockResolvedValue(pool); db.ordenTrabajo.findMany.mockImplementation(async ({ where }) => where.id.in.map((id: string) => ({ id })));
  db.costoRealPool.findMany.mockResolvedValue(actuals); db.corridaAsignacionPool.create.mockImplementation(async ({ data }) => ({ id: POOL, ...data, aplicaciones: data.aplicaciones.create }));
});

describe('pools indirectos por orden', () => {
  it('rechaza primero una corrida sin CIF real y nunca inventa cero o presupuesto', async () => {
    db.costoRealPool.findMany.mockResolvedValue([]);
    await expect(new PoolIndirectoService(db as never).run(USER, POOL, { periodo: '2026-09', aplicaciones: [{ ordenId: ORDER, cantidadBase: 130 }] }, actor))
      .rejects.toMatchObject({ statusCode: 422, message: 'Sin CIF real cargado para 2026-09' });
    expect(db.corridaAsignacionPool.create).not.toHaveBeenCalled();
  });

  it('FX-OT calcula cuota, variaciones e importe real asignado a X', async () => {
    const result = await new PoolIndirectoService(db as never).run(USER, POOL, { periodo: '2026-09', aplicaciones: [{ ordenId: ORDER, cantidadBase: 130 }, { ordenId: ORDER_2, cantidadBase: 770 }] }, actor);
    expect(Number(result.tasaFija)).toBe(1500); expect(Number(result.tasaVariable)).toBe(500); expect(Number(result.tasaTotal)).toBe(2000);
    expect(Number(result.cifReal)).toBe(1_995_000); expect(Number(result.variacionPresupuesto)).toBe(45_000); expect(Number(result.variacionVolumen)).toBe(150_000);
    expect(result).toMatchObject({ sentidoPresupuesto: 'DESFAVORABLE', sentidoVolumen: 'DESFAVORABLE' });
    expect(result.aplicaciones[0]).toMatchObject({ ordenId: ORDER, cantidadBase: 130, importe: 266_500 });
    expect(result.costosRealesUsados).toEqual(actuals.map((x) => x.id));
  });

  it('una corrección conserva el original y una corrida nueva usa sólo el vigente', async () => {
    const correction = { ...actuals[1], id: '66666666-6666-6666-6666-666666666666', importe: 505_000, reemplazaAId: actuals[1]!.id };
    db.costoRealPool.findMany.mockResolvedValue([...actuals, correction]);
    const result = await new PoolIndirectoService(db as never).run(USER, POOL, { periodo: '2026-09', aplicaciones: [{ ordenId: ORDER, cantidadBase: 900 }] }, actor);
    expect(Number(result.cifReal)).toBe(2_005_000);
    expect(result.costosRealesUsados).toEqual([actuals[0]!.id, correction.id]);
  });

  it('13b agrega retrabajo sin cambiar la foto anterior y asigna 13.722,22 de variación a X', async () => {
    const rework = { ...actuals[1], id: '88888888-8888-8888-8888-888888888888', concepto: 'retrabajo', importe: 50_000 };
    db.costoRealPool.findMany.mockResolvedValue([...actuals, rework]);
    const result = await new PoolIndirectoService(db as never).run(USER, POOL, { periodo: '2026-09', aplicaciones: [{ ordenId: ORDER, cantidadBase: 130 }, { ordenId: ORDER_2, cantidadBase: 770 }] }, actor);
    expect(Number(result.cifReal)).toBe(2_045_000); expect(Number(result.variacionPresupuesto)).toBe(95_000);
    expect(result.aplicaciones[0]!.importe).toBe(273_722.22);
  });

  it('administración y comercialización no se cargan al costo de la orden', async () => {
    db.poolIndirecto.findFirst.mockResolvedValue({ ...pool, tipo: 'ADMINISTRACION' });
    const result = await new PoolIndirectoService(db as never).run(USER, POOL, { periodo: '2026-09', aplicaciones: [{ ordenId: ORDER, cantidadBase: 900 }] }, actor);
    expect(result.aplicaciones[0]!.importe).toBe(0);
  });
});
