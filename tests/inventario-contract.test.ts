import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('contrato de movimientos de inventario', () => {
  const document = JSON.parse(
    readFileSync(new URL('../openapi/openapi.json', import.meta.url), 'utf8'),
  ) as {
    paths: Record<string, Record<string, {
      parameters?: Array<{ name?: string }>;
      responses?: Record<string, { content?: { 'application/json'?: { schema?: unknown } } }>;
    }>>;
  };
  const path = document.paths['/companies/{companyId}/movimientos-inventario'];

  it('publica el GET de salidas elegibles con filtros por artículo y orden', () => {
    expect(path?.get).toBeDefined();
    expect(path?.get?.parameters?.map((parameter) => parameter.name)).toEqual(
      expect.arrayContaining(['companyId', 'articuloId', 'ordenId']),
    );
  });

  it('declara costoUnitario en la respuesta del POST', () => {
    expect(JSON.stringify(path?.post?.responses?.['201'])).toContain('costoUnitario');
  });
});
