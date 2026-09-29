import { z } from 'zod';

const codigo = z.string().trim().min(1).max(40).transform((value) => value.toLocaleLowerCase('es'));
const nombre = z.string().trim().min(1).max(120);
const factor = z.number().finite().positive();

export const unidadMedidaCreateSchema = z.object({
  codigo,
  nombre,
  baseId: z.string().uuid().nullable().optional(),
  factor: factor.optional(),
}).superRefine((value, ctx) => {
  if (value.baseId && value.factor == null) ctx.addIssue({ code: 'custom', path: ['factor'], message: 'El factor es obligatorio para una unidad derivada' });
  if (!value.baseId && value.factor != null && value.factor !== 1) ctx.addIssue({ code: 'custom', path: ['factor'], message: 'El factor de una unidad base debe ser 1' });
});

export const unidadMedidaUpdateSchema = z.object({
  codigo: codigo.optional(),
  nombre: nombre.optional(),
  baseId: z.string().uuid().nullable().optional(),
  factor: factor.optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Informá al menos un campo para cambiar' });

export const unidadMedidaSchema = z.object({
  id: z.string().uuid(), codigo: z.string(), nombre: z.string(),
  base: z.object({ id: z.string().uuid(), codigo: z.string(), nombre: z.string() }).nullable(),
  factor: z.number(),
});
export const unidadMedidaEnvelopeSchema = z.object({ data: unidadMedidaSchema });
export const unidadesMedidaEnvelopeSchema = z.object({ data: z.array(unidadMedidaSchema) });

export type UnidadMedidaCreateInput = z.infer<typeof unidadMedidaCreateSchema>;
export type UnidadMedidaUpdateInput = z.infer<typeof unidadMedidaUpdateSchema>;
