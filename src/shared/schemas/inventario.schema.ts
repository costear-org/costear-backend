import { z } from 'zod';

export const articuloCreateSchema = z.object({
  codigo: z.string().trim().min(1).max(80),
  descripcion: z.string().trim().min(1).max(300),
  unidadId: z.string().uuid(),
  almacenable: z.boolean().default(true),
});

export const movimientoInventarioCreateSchema = z.object({
  articuloId: z.string().uuid(), depositoId: z.string().uuid().nullable().optional(),
  tipo: z.enum(['INGRESO', 'SALIDA', 'DEVOLUCION', 'TRANSFERENCIA', 'AJUSTE']), cantidad: z.number().finite().positive(),
  costoUnitario: z.number().finite().nonnegative().optional(),
  gastosCompra: z.number().finite().nonnegative().default(0),
  fecha: z.string().date(), ordenId: z.string().uuid().nullable().optional(),
  ordenDestinoId: z.string().uuid().nullable().optional(), movimientoOrigenId: z.string().uuid().nullable().optional(),
  documento: z.string().trim().max(300).nullable().optional(), periodoImputado: z.string().date(),
  identidadExterna: z.string().trim().min(1).max(200).nullable().optional(),
  documentoHash: z.string().trim().regex(/^[a-fA-F0-9]{64}$/).nullable().optional(),
}).superRefine((value, ctx) => {
  if ((value.identidadExterna == null) !== (value.documentoHash == null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La identidad externa y el hash del documento deben informarse juntos', path: ['identidadExterna'] });
  }
});

export type ArticuloCreateInput = z.infer<typeof articuloCreateSchema>;
export type MovimientoInventarioCreateInput = z.infer<typeof movimientoInventarioCreateSchema>;

export const salidasElegiblesQuerySchema = z.object({
  articuloId: z.string().uuid().optional(),
  ordenId: z.string().uuid().optional(),
});
export type SalidasElegiblesQuery = z.infer<typeof salidasElegiblesQuerySchema>;

const unidadArticuloSchema = z.object({
  id: z.string().uuid(), nombre: z.string(), simbolo: z.string(),
});

export const articuloSchema = z.object({
  id: z.string().uuid(), codigo: z.string(), descripcion: z.string(), unidadId: z.string().uuid(),
  unidad: unidadArticuloSchema,
  almacenable: z.boolean(), saldoCantidad: z.number(), saldoValor: z.number(), ppp: z.number(),
}).passthrough();
export const articuloCreadoSchema = z.object({
  id: z.string().uuid(), codigo: z.string(), descripcion: z.string(), unidadId: z.string().uuid(),
  unidad: unidadArticuloSchema, almacenable: z.boolean(),
}).passthrough();
export const articuloEnvelopeSchema = z.object({ data: articuloCreadoSchema });
export const articulosEnvelopeSchema = z.object({ data: z.array(articuloSchema) });
export const movimientoInventarioEnvelopeSchema = z.object({
  data: z.object({ id: z.string().uuid(), costoUnitario: z.coerce.number().nonnegative() }).passthrough(),
});
export const salidaElegibleSchema = z.object({
  id: z.string().uuid(), articuloId: z.string().uuid(), ordenId: z.string().uuid(),
  cantidadOriginal: z.number().positive(), cantidadDisponible: z.number().positive(),
  fecha: z.string().date(), documento: z.string().nullable(), costoUnitario: z.number().nonnegative(),
});
export const salidasElegiblesEnvelopeSchema = z.object({ data: z.array(salidaElegibleSchema) });
