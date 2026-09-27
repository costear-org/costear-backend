import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InformeDesvioOrdenService } from '@/application/ordenes/informe-desvio-orden-service.js';

const USER = '11111111-1111-1111-1111-111111111111';
const ORDER = '22222222-2222-4222-8222-222222222222';
const STAGE = '33333333-3333-4333-8333-333333333333';
const DELIVERY = '44444444-4444-4444-8444-444444444444';

const { db } = vi.hoisted(() => ({ db: {
  ordenTrabajo: { findFirst: vi.fn() },
} }));
vi.mock('@/infrastructure/database/prisma.js', () => ({
  prisma: db,
  withTenant: async (_id: string, fn: (tx: typeof db) => unknown) => fn(db),
}));

beforeEach(() => {
  vi.clearAllMocks();
  db.ordenTrabajo.findFirst.mockResolvedValue({
    id: ORDER,
    estado: 'EN_PRODUCCION',
    presupuestos: [
      { tipo: 'BASE', estado: 'APROBADO', costoPrevisto: 1_400_000, precio: 2_100_000, renglones: [
        { elemento: 'MP', etapaId: STAGE, cantidad: 1, precio: 260_000 },
        { elemento: 'MOD', etapaId: STAGE, cantidad: 1, precio: 640_000 },
        { elemento: 'CIP', etapaId: STAGE, cantidad: 1, precio: 300_000 },
        { elemento: 'ENTREGA', etapaId: DELIVERY, cantidad: 1, precio: 200_000 },
      ] },
      { tipo: 'ADICIONAL', estado: 'APROBADO', costoPrevisto: 100_000, precio: 150_000, renglones: [
        { elemento: 'ENTREGA', etapaId: DELIVERY, cantidad: 1, precio: 100_000 },
      ] },
    ],
    movimientosInventario: [
      { tipo: 'SALIDA', cantidad: 60, costoUnitario: 1_000 },
      { tipo: 'SALIDA', cantidad: 30, costoUnitario: 1_180 },
      { tipo: 'DEVOLUCION', cantidad: 5, costoUnitario: 1_180 },
      { tipo: 'SALIDA', cantidad: 60, costoUnitario: 400 },
      { tipo: 'SALIDA', cantidad: 1, costoUnitario: 160_000 },
    ],
    movimientosDestino: [],
    partesHoras: [
      { estado: 'APROBADO', importeMod: 675_000, etapa: { esEntrega: false } },
      { estado: 'APROBADO', importeMod: 80_000, etapa: { esEntrega: true } },
    ],
    costosDirectos: [
      { estadoValidacion: 'VALIDADO', categoria: 'TRANSPORTE', importe: 180_000, etapa: { esEntrega: true } },
      { estadoValidacion: 'VALIDADO', categoria: 'GRUA', importe: 0, etapa: { esEntrega: true } },
      { estadoValidacion: 'VALIDADO', categoria: 'VIATICOS', importe: 30_000, etapa: { esEntrega: true } },
    ],
    aplicacionesIndirectos: [
      { importe: 266_500, corrida: { pool: { tipo: 'FABRIL' } } },
      { importe: 60_000, corrida: { pool: { tipo: 'FABRIL' } } },
      { importe: 99_000, corrida: { pool: { tipo: 'ADMINISTRACION' } } },
    ],
  });
});

describe('informe de desvío por orden', () => {
  it('FX-OT cuadra costo, márgenes y puente al peso', async () => {
    const result = await new InformeDesvioOrdenService(db as never).get(USER, ORDER);

    expect(result).toMatchObject({
      costoPresupuestado: 1_500_000,
      costoReal: 1_565_000,
      precioContractual: 2_250_000,
      margenEsperado: 750_000,
      margenReal: 685_000,
      desvioTotal: 65_000,
      sentido: 'DESFAVORABLE',
    });
    expect(result.elementos).toEqual([
      expect.objectContaining({ elemento: 'MP', presupuestado: 260_000, real: 273_500, desvio: 13_500, sentido: 'DESFAVORABLE' }),
      expect.objectContaining({ elemento: 'MOD', presupuestado: 640_000, real: 675_000, desvio: 35_000, sentido: 'DESFAVORABLE' }),
      expect.objectContaining({ elemento: 'CIF', presupuestado: 300_000, real: 326_500, desvio: 26_500, sentido: 'DESFAVORABLE' }),
      expect.objectContaining({ elemento: 'ENTREGA', presupuestado: 300_000, real: 290_000, desvio: -10_000, sentido: 'FAVORABLE' }),
    ]);
    expect(result.puente.reduce((total, item) => total + item.importe, 0)).toBe(result.desvioTotal);
  });

  it('mantiene el puente cuadrado cuando cambian las políticas ya materializadas en los hechos', async () => {
    const current = await db.ordenTrabajo.findFirst();
    db.ordenTrabajo.findFirst.mockResolvedValue({
      ...current,
      partesHoras: [{ estado: 'APROBADO', importeMod: 650_000, etapa: { esEntrega: false } }, ...current.partesHoras.slice(1)],
      aplicacionesIndirectos: current.aplicacionesIndirectos.map((row: { importe: number }, index: number) => index === 0 ? { ...row, importe: 273_722.22 } : row),
    });

    const result = await new InformeDesvioOrdenService(db as never).get(USER, ORDER);
    expect(result.elementos.find((item) => item.elemento === 'MOD')?.real).toBe(650_000);
    expect(result.elementos.find((item) => item.elemento === 'CIF')?.real).toBe(333_722.22);
    expect(result.puente.reduce((total, item) => total + item.importe, 0)).toBeCloseTo(result.desvioTotal, 2);
  });
});
