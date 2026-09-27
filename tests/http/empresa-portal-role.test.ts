import Fastify, { type FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const inviteOperator = vi.hoisted(() => vi.fn());
const listAssignableEntities = vi.hoisted(() => vi.fn());
const listOperationalCatalog = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ role: 'EMPRESA_OPERATOR' }));
vi.mock('../../src/application/empresa/empresa-portal-service.js', () => ({
  EmpresaPortalService: class { inviteOperator = inviteOperator; },
}));
vi.mock('../../src/application/empresa/operator-scope-service.js', () => ({
  PERMISOS_OPERADOR: [
    'ordenes.ver', 'ordenes.editar', 'ordenes.ver_margen', 'ordenes.aprobar_presupuesto',
    'ordenes.cerrar', 'inventario.mover', 'horas.cargar', 'horas.aprobar',
  ],
  OperatorScopeService: class { listAssignableEntities = listAssignableEntities; listOperationalCatalog = listOperationalCatalog; },
}));
vi.mock('../../src/infrastructure/http/plugins/authenticate.js', async (original) => {
  const actual = await original<typeof import('../../src/infrastructure/http/plugins/authenticate.js')>();
  return {
    ...actual,
    authenticate: async (request: FastifyRequest) => {
      request.authUser = { id: '11111111-1111-4111-8111-111111111111', tenantId: 'tenant', role: authState.role };
    },
  };
});

import { registerEmpresaPortalRoutes } from '../../src/infrastructure/http/routes/empresa-portal.routes.js';
import { errorHandler } from '../../src/infrastructure/http/error-handler.js';

describe('CRUD de cargadores — roles', () => {
  beforeEach(() => {
    authState.role = 'EMPRESA_OPERATOR';
    vi.clearAllMocks();
  });
  it('un EMPRESA_OPERATOR recibe 403 al intentar invitar otro cargador', async () => {
    const app = Fastify();
    app.setErrorHandler(errorHandler);
    await registerEmpresaPortalRoutes(app);
    const response = await app.inject({
      method: 'POST', url: '/empresa-portal/22222222-2222-4222-8222-222222222222/operators',
      payload: { operatorName: 'Otra persona', operatorEmail: 'otra@example.test' },
    });
    expect(response.statusCode).toBe(403);
    expect(inviteOperator).not.toHaveBeenCalled();
  });

  it('un EMPRESA_OPERATOR recibe 403 al consultar entidades asignables', async () => {
    const app = Fastify();
    app.setErrorHandler(errorHandler);
    await registerEmpresaPortalRoutes(app);
    const response = await app.inject({
      method: 'GET', url: '/empresa-portal/22222222-2222-4222-8222-222222222222/assignable-entities',
    });
    expect(response.statusCode).toBe(403);
    expect(listAssignableEntities).not.toHaveBeenCalled();
  });

  it('un EMPRESA_ADMIN recibe el catálogo completo de entidades asignables', async () => {
    authState.role = 'EMPRESA_ADMIN';
    listAssignableEntities.mockResolvedValue({ unidadesProductivas: [{
      id: '33333333-3333-4333-8333-333333333333', referencia: 'A', etiqueta: 'Galpón',
    }], depositos: [] });
    const app = Fastify();
    app.setErrorHandler(errorHandler);
    await registerEmpresaPortalRoutes(app);
    const response = await app.inject({
      method: 'GET', url: '/empresa-portal/22222222-2222-4222-8222-222222222222/assignable-entities',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.unidadesProductivas).toHaveLength(1);
  });

  it('un EMPRESA_OPERATOR recibe el catálogo operativo de su conexión', async () => {
    listOperationalCatalog.mockResolvedValue({ estado: 'sin_entidades_autorizadas', mensaje: 'Sin asignación', acciones: [] });
    const app = Fastify();
    app.setErrorHandler(errorHandler);
    await registerEmpresaPortalRoutes(app);
    const response = await app.inject({
      method: 'GET', url: '/empresa-portal/connections/22222222-2222-4222-8222-222222222222/operational-catalog',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ estado: 'sin_entidades_autorizadas', mensaje: 'Sin asignación', acciones: [] });
  });
});
