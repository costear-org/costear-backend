import { z } from 'zod';

const nombreSchema = z.string().trim().min(1).max(200);
const categoriaResumenSchema = z.object({ id: z.string().uuid(), nombre: z.string() });

export const categoriaPersonalCreateSchema = z.object({ nombre: nombreSchema.max(160) });
export const categoriaPersonalSchema = z.object({ id: z.string().uuid(), nombre: z.string() });
export const categoriaPersonalEnvelopeSchema = z.object({ data: categoriaPersonalSchema });
export const categoriasPersonalEnvelopeSchema = z.object({ data: z.array(categoriaPersonalSchema) });

export const personaCreateSchema = z.object({
  nombre: nombreSchema,
  categoriaId: z.string().uuid().nullable().optional(),
  activa: z.boolean().optional(),
});
export const personaUpdateSchema = personaCreateSchema.partial().refine((value) => Object.keys(value).length > 0, 'Debe indicar al menos un cambio');
export const personaSchema = z.object({
  id: z.string().uuid(), nombre: z.string(), categoria: categoriaResumenSchema.nullable(), activa: z.boolean(),
});
export const personaEnvelopeSchema = z.object({ data: personaSchema });
export const personasEnvelopeSchema = z.object({ data: z.array(personaSchema) });

const tarifaBaseSchema = z.object({
  nombre: nombreSchema.max(160),
  categoriaId: z.string().uuid().nullable().optional(),
  basicRemuneration: z.number().nonnegative(),
  hoursWorked: z.number().positive(),
  productiveHours: z.number().positive().nullable().optional(),
  standardHours: z.number().positive().nullable().optional(),
  itcsPct: z.number().nonnegative(),
  primaExtraPct: z.number().nonnegative(),
  vigenteDesde: z.string().date(),
});
export const tarifaManoObraCreateSchema = tarifaBaseSchema.refine(
  (value) => value.productiveHours === undefined || value.productiveHours === null || value.productiveHours <= value.hoursWorked,
  { message: 'Las horas productivas no pueden superar las horas pagadas', path: ['productiveHours'] },
);
export const tarifaManoObraSchema = z.object({
  id: z.string().uuid(), nombre: z.string(), categoria: categoriaResumenSchema.nullable(),
  basicRemuneration: z.number(), hoursWorked: z.number(), productiveHours: z.number().nullable(),
  standardHours: z.number().nullable(), itcsPct: z.number(), primaExtraPct: z.number(),
  vigenteDesde: z.coerce.date(), tarifaHora: z.number(),
});
export const tarifaManoObraEnvelopeSchema = z.object({ data: tarifaManoObraSchema });
export const tarifasManoObraEnvelopeSchema = z.object({ data: z.array(tarifaManoObraSchema) });

export type CategoriaPersonalCreateInput = z.infer<typeof categoriaPersonalCreateSchema>;
export type PersonaCreateInput = z.infer<typeof personaCreateSchema>;
export type PersonaUpdateInput = z.infer<typeof personaUpdateSchema>;
export type TarifaManoObraCreateInput = z.infer<typeof tarifaManoObraCreateSchema>;
