import { z } from 'zod';

export const reaperturaOrdenSchema = z.object({ motivo: z.string().trim().min(1).max(500) });
export type ReaperturaOrdenInput = z.infer<typeof reaperturaOrdenSchema>;
export const fotoCierreOrdenSchema = z.object({
  id: z.string().uuid(), ordenId: z.string().uuid(), version: z.number().int().positive(),
  congelado: z.unknown(), versionMotor: z.string(), cerradoPor: z.string().uuid(),
  motivoReapertura: z.string().nullable(), anteriorId: z.string().uuid().nullable(), createdAt: z.coerce.date(),
}).passthrough();
export const fotoCierreOrdenEnvelopeSchema = z.object({ data: fotoCierreOrdenSchema });
export const fotosCierreOrdenEnvelopeSchema = z.object({ data: z.array(fotoCierreOrdenSchema) });
