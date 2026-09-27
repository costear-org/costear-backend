import { z } from 'zod';

export const paqueteRubroEmpresaEnvelopeSchema = z.object({
  data: z.object({
    category: z.string().nullable(),
    lexicon: z.record(z.string()),
  }),
});
