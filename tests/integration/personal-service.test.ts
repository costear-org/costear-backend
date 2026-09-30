import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PersonalService } from '@/application/ordenes/personal-service.js';
import { withTenant } from '@/infrastructure/database/prisma.js';
import { createTenant, disconnect, type Tenant } from './helpers/tenants.js';

let A: Tenant; let B: Tenant;
const service = new PersonalService();
const actor = (tenant: Tenant) => ({ id: tenant.userId, role: 'EMPRESA_ADMIN', area: 'costista', method: 'manual' });

beforeAll(async () => { A = await createTenant('personal-a'); B = await createTenant('personal-b'); });
afterAll(disconnect);

describe('C1-F4c — padrón y tarifas por empresa', () => {
  it('crea categorías y personas, audita y conserva las inactivas en el listado', async () => {
    const category = await service.createCategory(A.userId, A.companyId, { nombre: 'Oficial' }, actor(A));
    const person = await service.createPerson(A.userId, A.companyId, { nombre: 'Ana', categoriaId: category.id }, actor(A));
    const inactive = await service.updatePerson(A.userId, person.id, { activa: false }, actor(A));
    expect(inactive).toMatchObject({ nombre: 'Ana', categoria: { id: category.id }, activa: false });
    expect(await service.listPeople(A.userId, A.companyId)).toContainEqual(inactive);
    expect(await withTenant(A.userId, (tx) => tx.traceAuditLog.count({ where: { entityType: 'Persona', entityId: person.id } }))).toBe(2);
  });

  it('devuelve tarifaHora 5.000 usando calcDepartmentMod y rechaza la misma vigencia', async () => {
    const input = { nombre: 'Tarifa general', basicRemuneration: 400000, hoursWorked: 100, itcsPct: 25, primaExtraPct: 50, vigenteDesde: '2026-09-01' };
    const rate = await service.createRate(A.userId, A.companyId, input, actor(A));
    expect(rate.tarifaHora).toBe(5000);
    await expect(service.createRate(A.userId, A.companyId, input, actor(A))).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
  });

  it('aísla el padrón: una persona ajena se responde como 404', async () => {
    const foreign = await service.createPerson(B.userId, B.companyId, { nombre: 'Persona B' }, actor(B));
    await expect(service.updatePerson(A.userId, foreign.id, { nombre: 'No corresponde' }, actor(A))).rejects.toMatchObject({ statusCode: 404 });
    expect((await service.listPeople(A.userId, A.companyId)).some((person) => person.id === foreign.id)).toBe(false);
  });
});
