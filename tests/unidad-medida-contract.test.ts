import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { unidadMedidaCreateSchema, unidadMedidaUpdateSchema } from '../src/shared/schemas/unidad-medida.schema.js';

describe('contrato de unidades de medida', () => {
  it('rechaza una derivada sin factor positivo', () => {
    const baseId = '11111111-1111-4111-8111-111111111111';
    expect(unidadMedidaCreateSchema.safeParse({ codigo: 'm2', nombre: 'Metro cuadrado', baseId }).success).toBe(false);
    expect(unidadMedidaCreateSchema.safeParse({ codigo: 'm2', nombre: 'Metro cuadrado', baseId, factor: 0 }).success).toBe(false);
  });

  it('normaliza el código estable y exige al menos un cambio', () => {
    expect(unidadMedidaCreateSchema.parse({ codigo: ' M2 ', nombre: 'Metro cuadrado' }).codigo).toBe('m2');
    expect(unidadMedidaUpdateSchema.safeParse({}).success).toBe(false);
  });

  it.each([
    ['post', '/companies/{companyId}/unidades-medida'],
    ['get', '/companies/{companyId}/unidades-medida'],
    ['patch', '/unidades-medida/{id}'],
    ['delete', '/unidades-medida/{id}'],
    ['post', '/companies/{companyId}/depositos'],
  ])('declara %s %s con requestBody cuando corresponde', (method, path) => {
    const doc = JSON.parse(readFileSync(new URL('../openapi/openapi.json', import.meta.url), 'utf8')) as {
      paths: Record<string, Record<string, { requestBody?: unknown }>>;
    };
    const operation = doc.paths[path]?.[method];
    expect(operation).toBeDefined();
    if (method !== 'get' && method !== 'delete') expect(operation?.requestBody).toBeDefined();
  });
});
