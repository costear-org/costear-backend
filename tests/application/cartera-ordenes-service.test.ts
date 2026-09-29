import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CarteraOrdenesService } from '@/application/ordenes/cartera-ordenes-service.js';

const USER = '11111111-1111-1111-1111-111111111111';
const COMPANY = '22222222-2222-4222-8222-222222222222';
const A = '33333333-3333-4333-8333-333333333333';
const B = '44444444-4444-4444-8444-444444444444';

const { db } = vi.hoisted(() => ({ db: {
  company: { findFirst: vi.fn() },
  ordenTrabajo: { findMany: vi.fn(), findFirst: vi.fn() },
  alert: { count: vi.fn() },
} }));
vi.mock('@/infrastructure/database/prisma.js', () => ({
  prisma: db,
  withTenant: async (_id: string, fn: (tx: typeof db) => unknown) => fn(db),
}));

const informe = (id: string, costoReal: number) => ({
  id,
  estado: 'EN_PRODUCCION',
  presupuestos: [{ tipo: 'BASE', estado: 'APROBADO', costoPrevisto: 60, precio: 100, renglones: [
    { elemento: 'MP', cantidad: 1, precio: 60 },
  ] }],
  movimientosInventario: [{ tipo: 'SALIDA', cantidad: 1, costoUnitario: costoReal }],
  movimientosDestino: [], partesHoras: [], costosDirectos: [], aplicacionesIndirectos: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  db.company.findFirst.mockResolvedValue({ id: COMPANY });
  db.ordenTrabajo.findMany.mockResolvedValue([
    { id: A, codigo: 'OT-A', descripcion: 'A', cliente: 'Cliente A', estado: 'EN_PRODUCCION' },
    { id: B, codigo: 'OT-B', descripcion: 'B', cliente: 'Cliente B', estado: 'TERMINADA_TECNICA' },
    { id: COMPANY, codigo: 'OT-C', descripcion: 'C', cliente: 'Cliente C', estado: 'CERRADA' },
  ]);
  db.ordenTrabajo.findFirst
    .mockResolvedValueOnce(informe(A, 70))
    .mockResolvedValueOnce({ ...informe(B, 50), estado: 'TERMINADA_TECNICA' });
  db.alert.count.mockResolvedValue(2);
});

describe('cartera de órdenes', () => {
  it('excluye cerradas y ordena las activas por deterioro del margen', async () => {
    const result = await new CarteraOrdenesService(db as never).list(USER, COMPANY);

    expect(result.map((row) => row.codigo)).toEqual(['OT-A', 'OT-B']);
    expect(result[0]).toMatchObject({
      avancePct: 0, margenPresupuestadoPct: 40, margenProyectadoPct: 30, desvioPp: 10, alertasActivas: 2,
    });
    expect(result[1]).toMatchObject({ avancePct: 100, desvioPp: -10 });
  });
});
