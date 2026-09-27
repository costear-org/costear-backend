import { z } from 'zod';

const sentidoSchema = z.enum(['FAVORABLE', 'DESFAVORABLE', 'NEUTRA']);
const elementoSchema = z.enum(['MP', 'MOD', 'CIF', 'ENTREGA']);
const informeElementoSchema = z.object({
  elemento: elementoSchema,
  presupuestado: z.number(),
  real: z.number(),
  desvio: z.number(),
  sentido: sentidoSchema,
  comprometido: z.number(),
  proyeccionAlTerminar: z.number(),
});
const puenteSchema = z.object({
  causa: z.enum(['PRECIO', 'CANTIDAD', 'EFICIENCIA', 'ALCANCE', 'ASIGNACION']),
  elemento: elementoSchema,
  importe: z.number(),
  sentido: sentidoSchema,
});

export const informeDesvioOrdenSchema = z.object({
  ordenId: z.string().uuid(),
  costoPresupuestado: z.number(),
  costoReal: z.number(),
  precioContractual: z.number().optional(),
  margenEsperado: z.number().optional(),
  margenReal: z.number().optional(),
  desvioTotal: z.number(),
  sentido: sentidoSchema,
  elementos: z.array(informeElementoSchema),
  puente: z.array(puenteSchema),
  proyeccionAlTerminar: z.object({
    incurrido: z.number(), comprometido: z.number(), total: z.number(), presupuesto: z.number(),
  }),
});
export const informeDesvioOrdenEnvelopeSchema = z.object({ data: informeDesvioOrdenSchema });
