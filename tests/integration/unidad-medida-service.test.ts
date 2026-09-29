import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UnidadMedidaService } from '@/application/operacion/unidad-medida-service.js';
import { withTenant } from '@/infrastructure/database/prisma.js';
import { createTenant, disconnect, type Tenant } from './helpers/tenants.js';

let A: Tenant; let B: Tenant;
const service = new UnidadMedidaService();
const actor = (tenant: Tenant) => ({ id: tenant.userId, role: 'EMPRESA_ADMIN', area: 'costista', method: 'manual' });

beforeAll(async () => { A = await createTenant('unidad-a'); B = await createTenant('unidad-b'); });
afterAll(disconnect);

describe('C1-F3c — unidades de medida por empresa', () => {
  it('crea bases y derivadas, normaliza el código y audita en la misma operación', async () => {
    const base = await service.create(A.userId, A.companyId, { codigo: ' KG ', nombre: 'Kilogramo' }, actor(A));
    const derived = await service.create(A.userId, A.companyId, { codigo: 'bolsa', nombre: 'Bolsa', baseId: base.id, factor: 25 }, actor(A));
    expect(base).toMatchObject({ codigo: 'kg', factor: 1, base: null });
    expect(derived).toMatchObject({ factor: 25, base: { id: base.id, codigo: 'kg' } });
    expect(await withTenant(A.userId, (tx) => tx.traceAuditLog.count({ where: { entityType: 'UnidadMedida', entityId: derived.id, action: 'create' } }))).toBe(1);
  });

  it('rechaza código repetido por empresa pero permite el mismo código en otra', async () => {
    await service.create(A.userId, A.companyId, { codigo: 'm2', nombre: 'Metro cuadrado' }, actor(A));
    await expect(service.create(A.userId, A.companyId, { codigo: 'M2', nombre: 'Otro' }, actor(A))).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.create(B.userId, B.companyId, { codigo: 'm2', nombre: 'Metro cuadrado' }, actor(B))).resolves.toMatchObject({ codigo: 'm2' });
  });

  it('rechaza como base una unidad ajena o derivada', async () => {
    const foreign = await service.create(B.userId, B.companyId, { codigo: 'litro', nombre: 'Litro' }, actor(B));
    await expect(service.create(A.userId, A.companyId, { codigo: 'bidon', nombre: 'Bidón', baseId: foreign.id, factor: 20 }, actor(A))).rejects.toMatchObject({ statusCode: 400 });
    const base = await service.create(A.userId, A.companyId, { codigo: 'unidad', nombre: 'Unidad' }, actor(A));
    const derived = await service.create(A.userId, A.companyId, { codigo: 'caja', nombre: 'Caja', baseId: base.id, factor: 12 }, actor(A));
    await expect(service.create(A.userId, A.companyId, { codigo: 'pallet', nombre: 'Pallet', baseId: derived.id, factor: 10 }, actor(A))).rejects.toMatchObject({ statusCode: 400 });
  });

  it('aísla el listado y bloquea cambios estructurales o baja cuando está usada', async () => {
    const unit = await service.create(A.userId, A.companyId, { codigo: 'pieza', nombre: 'Pieza' }, actor(A));
    await withTenant(A.userId, (tx) => tx.articulo.create({ data: { companyId: A.companyId, userId: A.userId, codigo: 'articulo-unidad', descripcion: 'Artículo de prueba', unidadId: unit.id, almacenable: true } }));
    await expect(service.update(A.userId, unit.id, { factor: 2 }, actor(A))).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.remove(A.userId, unit.id, actor(A))).rejects.toMatchObject({ statusCode: 409 });
    expect((await service.list(B.userId, B.companyId)).some((row) => row.id === unit.id)).toBe(false);
  });

  it('cambia el nombre y borra lógicamente una unidad libre', async () => {
    const unit = await service.create(A.userId, A.companyId, { codigo: 'hora', nombre: 'Hora' }, actor(A));
    await expect(service.update(A.userId, unit.id, { nombre: 'Hora de trabajo' }, actor(A))).resolves.toMatchObject({ nombre: 'Hora de trabajo' });
    await service.remove(A.userId, unit.id, actor(A));
    expect((await service.list(A.userId, A.companyId)).some((row) => row.id === unit.id)).toBe(false);
  });
});
