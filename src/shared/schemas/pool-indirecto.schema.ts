import { z } from 'zod';

const periodo = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Usá un período AAAA-MM');
const money = z.number().finite().nonnegative();

export const poolIndirectoCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(160),
  tipo: z.enum(['FABRIL', 'ADMINISTRACION', 'COMERCIALIZACION']),
  base: z.enum(['HORAS_HOMBRE', 'HORAS_MAQUINA', 'SUPERFICIE', 'DIAS_OCUPACION', 'MOVIMIENTOS', 'OTRA']),
  presupuestoFijo: money, presupuestoVariable: money, capacidadNormal: z.number().finite().positive(), periodo,
});
export const costoRealPoolCreateSchema = z.object({
  periodo, concepto: z.string().trim().min(1).max(200), naturaleza: z.enum(['FIJO', 'VARIABLE']),
  importe: money, origen: z.string().trim().min(1).max(500), reemplazaA: z.string().uuid().nullable().optional(),
});
export const corridaPoolCreateSchema = z.object({
  periodo,
  aplicaciones: z.array(z.object({ ordenId: z.string().uuid(), cantidadBase: z.number().finite().positive() })).min(1),
});
export const costosRealesPoolQuerySchema = z.object({ periodo: periodo.optional() });

const pool = z.object({ id: z.string().uuid(), companyId: z.string().uuid(), presupuestoFijo: z.coerce.number(), presupuestoVariable: z.coerce.number(), capacidadNormal: z.coerce.number() }).passthrough();
const costoReal = z.object({ id: z.string().uuid(), poolId: z.string().uuid(), importe: z.coerce.number(), reemplazaAId: z.string().uuid().nullable() }).passthrough();
const aplicacion = z.object({ ordenId: z.string().uuid(), cantidadBase: z.coerce.number(), importe: z.coerce.number() }).passthrough();
const corrida = z.object({
  id: z.string().uuid(), poolId: z.string().uuid(), tasaFija: z.coerce.number(), tasaVariable: z.coerce.number(), tasaTotal: z.coerce.number(),
  cifReal: z.coerce.number(), cifRealFijo: z.coerce.number(), cifRealVariable: z.coerce.number(), variacionPresupuesto: z.coerce.number(),
  variacionVolumen: z.coerce.number(), aplicaciones: z.array(aplicacion),
}).passthrough();
export const poolIndirectoEnvelopeSchema = z.object({ data: pool });
export const costoRealPoolEnvelopeSchema = z.object({ data: costoReal });
export const costosRealesPoolEnvelopeSchema = z.object({ data: z.array(costoReal) });
export const corridaPoolEnvelopeSchema = z.object({ data: corrida });
export const corridasPoolEnvelopeSchema = z.object({ data: z.array(corrida) });
export type PoolIndirectoCreateInput = z.infer<typeof poolIndirectoCreateSchema>;
export type CostoRealPoolCreateInput = z.infer<typeof costoRealPoolCreateSchema>;
export type CorridaPoolCreateInput = z.infer<typeof corridaPoolCreateSchema>;
