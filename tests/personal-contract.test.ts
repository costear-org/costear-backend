import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { personaUpdateSchema, tarifaManoObraCreateSchema } from '../src/shared/schemas/personal.schema.js';

describe('contrato de padrón y tarifas de mano de obra', () => {
  it('rechaza actualizaciones vacías y horas productivas mayores que las pagadas', () => {
    expect(personaUpdateSchema.safeParse({}).success).toBe(false);
    expect(tarifaManoObraCreateSchema.safeParse({ nombre: 'Oficial', basicRemuneration: 400000, hoursWorked: 100, productiveHours: 101, itcsPct: 25, primaExtraPct: 50, vigenteDesde: '2026-09-01' }).success).toBe(false);
  });

  it.each([
    ['get', '/companies/{companyId}/categorias-personal'], ['post', '/companies/{companyId}/categorias-personal'],
    ['get', '/companies/{companyId}/personas'], ['post', '/companies/{companyId}/personas'], ['patch', '/personas/{id}'],
    ['get', '/companies/{companyId}/tarifas-mano-obra'], ['post', '/companies/{companyId}/tarifas-mano-obra'],
  ])('declara %s %s y requestBody para mutaciones', (method, path) => {
    const doc = JSON.parse(readFileSync(new URL('../openapi/openapi.json', import.meta.url), 'utf8')) as { paths: Record<string, Record<string, { requestBody?: unknown }>> };
    const operation = doc.paths[path]?.[method]; expect(operation).toBeDefined();
    if (method !== 'get') expect(operation?.requestBody).toBeDefined();
  });
});
