import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PaqueteRubroService } from '../../../application/operacion/paquete-rubro-service.js';
import { apiErrorResponses } from '../../../shared/schemas/api-contract.schema.js';
import { paqueteRubroEmpresaEnvelopeSchema } from '../../../shared/schemas/paquete-rubro.schema.js';
import { authenticate } from '../plugins/authenticate.js';

const companyParams = z.object({ companyId: z.string().uuid() });

export async function registerPaqueteRubroRoutes(app: FastifyInstance): Promise<void> {
  const service = new PaqueteRubroService();
  app.withTypeProvider<ZodTypeProvider>().get(
    '/companies/:companyId/paquete-rubro',
    {
      preHandler: authenticate,
      schema: {
        params: companyParams,
        response: { 200: paqueteRubroEmpresaEnvelopeSchema, ...apiErrorResponses },
      },
    },
    async (request) => ({
      data: await service.resolveCompanyLexicon(request.authUser!.id, request.params.companyId),
    }),
  );
}
