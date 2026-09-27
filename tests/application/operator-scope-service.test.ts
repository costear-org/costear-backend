import { describe, expect, it, vi } from 'vitest';
import { OperatorScopeService } from '../../src/application/empresa/operator-scope-service.js';

function db(overrides: Record<string, unknown> = {}) {
  return {
    company: { findFirst: vi.fn().mockResolvedValue(null) },
    unidadProductiva: { findMany: vi.fn().mockResolvedValue([]) },
    deposito: { findMany: vi.fn().mockResolvedValue([]) },
    paqueteRubro: { findMany: vi.fn().mockResolvedValue([]) },
    configuracionModuloRubro: { findMany: vi.fn().mockResolvedValue([]) },
    operatorUnidadProductiva: { findFirst: vi.fn().mockResolvedValue(null) },
    operatorDeposito: { findFirst: vi.fn().mockResolvedValue(null) },
    operatorOrdenTrabajo: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    operatorMembership: { findFirst: vi.fn().mockResolvedValue(null) },
    loteProductivo: { findUnique: vi.fn() },
    traceAuditLog: { create: vi.fn().mockResolvedValue({}) },
    ...overrides,
  } as never;
}

const actor = { id: '11111111-1111-4111-8111-111111111111', role: 'EMPRESA_OPERATOR', area: 'costista', method: 'manual' };

describe('alcance por entidad del cargador', () => {
  it('niega por defecto una membresía sin entidades autorizadas y audita el intento', async () => {
    const mock = db();
    await expect(new OperatorScopeService(mock).assertDeposito(actor.id, '22222222-2222-4222-8222-222222222222', actor))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(mock.traceAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'scope.denied' }),
    }));
  });

  it('autoriza solamente el depósito asignado', async () => {
    const findFirst = vi.fn().mockResolvedValue({ membershipId: 'membership' });
    const mock = db({ operatorDeposito: { findFirst } });
    await expect(new OperatorScopeService(mock).assertDeposito(actor.id, '22222222-2222-4222-8222-222222222222', actor)).resolves.toBeUndefined();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ membership: { operatorId: actor.id, isActive: true } }),
    }));
  });

  it('niega por defecto el informe de margen sin permiso explícito', async () => {
    await expect(new OperatorScopeService(db()).assertPermission(actor.id, 'ordenes.ver_margen'))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('exige entidad y función para acceder a una orden', async () => {
    const findFirst = vi.fn().mockResolvedValue({ membershipId: 'membership' });
    const mock = db({ operatorOrdenTrabajo: { findFirst, findMany: vi.fn() } });
    await expect(new OperatorScopeService(mock).assertOrden(actor.id, '33333333-3333-4333-8333-333333333333', 'ordenes.ver'))
      .resolves.toBeUndefined();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      membership: { operatorId: actor.id, isActive: true, permisos: { has: 'ordenes.ver' } },
    }) }));
  });

  it('lista todas las entidades asignables con las etiquetas del paquete', async () => {
    const mock = db({
      company: { findFirst: vi.fn().mockResolvedValue({ id: 'company', industry: 'AVICULTURA' }) },
      unidadProductiva: { findMany: vi.fn().mockResolvedValue([
        { id: 'unidad-a', referencia: 'A' }, { id: 'unidad-b', referencia: 'B' },
      ]) },
      deposito: { findMany: vi.fn().mockResolvedValue([{ id: 'deposito-1', referencia: 'Principal' }]) },
      paqueteRubro: { findMany: vi.fn().mockResolvedValue([{ companyId: null, userId: null, lexicon: {
        UnidadProductiva: 'Galpón', Deposito: 'Silo',
      } }]) },
    });

    await expect(new OperatorScopeService(mock).listAssignableEntities('company', 'admin')).resolves.toEqual({
      unidadesProductivas: [
        { id: 'unidad-a', referencia: 'A', etiqueta: 'Galpón' },
        { id: 'unidad-b', referencia: 'B', etiqueta: 'Galpón' },
      ],
      depositos: [{ id: 'deposito-1', referencia: 'Principal', etiqueta: 'Silo' }],
    });
  });

  it('sin entidades autorizadas devuelve un estado explícito y nunca todas las opciones', async () => {
    const mock = db({ operatorMembership: { findFirst: vi.fn().mockResolvedValue({
      connection: { id: 'connection', costistId: 'admin', companyId: 'company', company: { industry: 'AVICULTURA' } },
      unidadesAutorizadas: [], depositosAutorizados: [],
    }) } });

    await expect(new OperatorScopeService(mock).listOperationalCatalog(actor.id, 'connection')).resolves.toEqual({
      estado: 'sin_entidades_autorizadas',
      mensaje: 'Todavía no te asignaron ninguna entidad para cargar datos.',
      acciones: [],
    });
    expect(mock.unidadProductiva.findMany).not.toHaveBeenCalled();
    expect(mock.deposito.findMany).not.toHaveBeenCalled();
  });

  it('expande las acciones del paquete sólo para la entidad autorizada', async () => {
    const mock = db({
      operatorMembership: { findFirst: vi.fn().mockResolvedValue({
        connection: { id: 'connection', costistId: 'admin', companyId: 'company', company: { industry: 'AVICULTURA' } },
        unidadesAutorizadas: [{ unidadProductiva: { id: 'unidad-a', referencia: 'A' } }],
        depositosAutorizados: [],
      }) },
      paqueteRubro: { findMany: vi.fn().mockResolvedValue([{ companyId: null, userId: null,
        lexicon: { UnidadProductiva: 'Galpón', Deposito: 'Silo' },
        access: { actions: [{ moduloId: 'produccion', clave: 'registrar-produccion', nombre: 'Registrar producción', descripcion: 'Registrar producción.', superficie: 'carga.produccion-diaria', destino: '/panel-campo', entidadDestino: 'UnidadProductiva' }] },
        modulos: [{ clave: 'produccion', activoPorDefecto: true }],
      }]) },
    });

    const result = await new OperatorScopeService(mock).listOperationalCatalog(actor.id, 'connection');
    expect(result).toMatchObject({ estado: 'disponible', mensaje: null });
    expect(result.acciones).toEqual([{ clave: 'registrar-produccion', nombre: 'Registrar producción',
      descripcion: 'Registrar producción.', superficie: 'carga.produccion-diaria', destino: '/panel-campo',
      entidad: { tipo: 'UnidadProductiva', id: 'unidad-a', referencia: 'A', etiqueta: 'Galpón' },
    }]);
    expect(JSON.stringify(result)).not.toContain('unidad-b');
  });
});
