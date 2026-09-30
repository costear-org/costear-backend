import Fastify, { type FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listPeople = vi.hoisted(() => vi.fn());
const listRates = vi.hoisted(() => vi.fn());
const createPerson = vi.hoisted(() => vi.fn());
const tenantForCompanyAny = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ role: 'EMPRESA_OPERATOR' }));

vi.mock('../../src/application/ordenes/personal-service.js', () => ({
  PersonalService: class {
    listPeople = listPeople; listRates = listRates; createPerson = createPerson;
  },
}));
vi.mock('../../src/application/empresa/operator-scope-service.js', () => ({
  OperatorScopeService: class { tenantForCompanyAny = tenantForCompanyAny; },
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

import { registerPersonalRoutes } from '../../src/infrastructure/http/routes/personal.routes.js';
import { errorHandler } from '../../src/infrastructure/http/error-handler.js';

const companyId = '22222222-2222-4222-8222-222222222222';
const build = async () => { const app = Fastify(); app.setErrorHandler(errorHandler); await registerPersonalRoutes(app); return app; };

describe('C1-F4c — contrato y permisos del padrón', () => {
  beforeEach(() => { authState.role = 'EMPRESA_OPERATOR'; vi.clearAllMocks(); });

  it('rechaza tarifas y altas de personas para un operador aunque cargue horas', async () => {
    const app = await build();
    const rates = await app.inject({ method: 'GET', url: `/companies/${companyId}/tarifas-mano-obra` });
    const person = await app.inject({ method: 'POST', url: `/companies/${companyId}/personas`, payload: { nombre: 'Operario' } });
    expect(rates.statusCode).toBe(403); expect(person.statusCode).toBe(403);
    expect(listRates).not.toHaveBeenCalled(); expect(createPerson).not.toHaveBeenCalled();
  });

  it('permite listar personas con horas.cargar u horas.aprobar sin filtrar importes', async () => {
    tenantForCompanyAny.mockResolvedValue('33333333-3333-4333-8333-333333333333');
    listPeople.mockResolvedValue([{ id: '44444444-4444-4444-8444-444444444444', nombre: 'Ana', categoria: null, activa: false, tarifaHora: 5000, importe: 10000 }]);
    const app = await build();
    const response = await app.inject({ method: 'GET', url: `/companies/${companyId}/personas` });
    expect(response.statusCode).toBe(200);
    expect(tenantForCompanyAny).toHaveBeenCalledWith(expect.any(String), companyId, ['horas.cargar', 'horas.aprobar']);
    expect(Object.keys(response.json().data[0]).some((key) => key.toLowerCase().includes('tarifa') || key.toLowerCase().includes('importe'))).toBe(false);
    expect(response.json().data[0]).toMatchObject({ nombre: 'Ana', activa: false });
  });
});
