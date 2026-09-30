import { z } from 'zod';

export const costoDirectoCreateSchema = z.object({
  etapaId: z.string().uuid(),
  categoria: z.enum(['TERCEROS', 'TRANSPORTE', 'GRUA', 'VIATICOS', 'COMPRA_EXCLUSIVA', 'OTRO']),
  importe: z.number().positive(), documento: z.string().trim().min(1).max(500).nullable().optional(),
  periodoImputado: z.string().date(),
});

export const contingenciaCreateSchema = z.object({
  etapaId: z.string().uuid(), tipo: z.enum(['DESPERDICIO', 'SOBRANTE', 'ROTURA', 'FALLA', 'RETRABAJO']),
  cantidad: z.number().positive(), valor: z.number().nonnegative(), recupero: z.number().nonnegative().nullable().optional(),
  causa: z.string().trim().min(1).max(500), tratamiento: z.string().trim().min(1).max(500),
  unidadId: z.string().uuid().nullable().optional(),
  versionPresupuestoId: z.string().uuid().nullable().optional(),
}).superRefine((value, context) => {
  if (value.tipo === 'FALLA' && value.recupero == null && !/reclamo/i.test(value.tratamiento)) {
    context.addIssue({ code: 'custom', path: ['tratamiento'], message: 'Una falla de proveedor exige recupero o reclamo' });
  }
});

export const rechazoSchema = z.object({ motivo: z.string().trim().min(1).max(500) });
const estadoValidacionSchema = z.enum(['PENDIENTE', 'VALIDADO', 'MARCADO', 'RECHAZADO']);
const costoDirectoSchema = z.object({
  id: z.string().uuid(), ordenId: z.string().uuid(), etapaId: z.string().uuid(),
  categoria: z.enum(['TERCEROS', 'TRANSPORTE', 'GRUA', 'VIATICOS', 'COMPRA_EXCLUSIVA', 'OTRO']),
  importe: z.number(), documento: z.string().nullable(), periodoImputado: z.string().date(),
  estadoValidacion: estadoValidacionSchema, motivoRechazo: z.string().nullable(), impactaCosto: z.boolean(),
});
const unidadLegibleSchema = z.object({ id: z.string().uuid(), nombre: z.string(), simbolo: z.string() });
const contingenciaSchema = z.object({
  id: z.string().uuid(), ordenId: z.string().uuid(), etapaId: z.string().uuid(),
  tipo: z.enum(['DESPERDICIO', 'SOBRANTE', 'ROTURA', 'FALLA', 'RETRABAJO']),
  cantidad: z.number(), unidad: unidadLegibleSchema.nullable(), valor: z.number(), recupero: z.number().nullable(),
  causa: z.string(), tratamiento: z.string(), estadoValidacion: estadoValidacionSchema, motivoRechazo: z.string().nullable(),
});
export const costoDirectoEnvelopeSchema = z.object({ data: costoDirectoSchema });
export const costosDirectosEnvelopeSchema = z.object({ data: z.array(costoDirectoSchema), resumen: z.object({ totalValidado: z.number(), entregaInstalacionValidada: z.number() }) });
export const contingenciaEnvelopeSchema = z.object({ data: contingenciaSchema });
export const contingenciasEnvelopeSchema = z.object({ data: z.array(contingenciaSchema), resumen: z.object({ perdidaPeriodoValidada: z.number(), cifPoolValidado: z.number(), adicionalValidado: z.number() }) });
export type CostoDirectoCreateInput = z.infer<typeof costoDirectoCreateSchema>;
export type ContingenciaCreateInput = z.infer<typeof contingenciaCreateSchema>;
