import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { PoolIndirectoService } from '../../../application/ordenes/pool-indirecto-service.js';
import { apiErrorResponses } from '../../../shared/schemas/api-contract.schema.js';
import { authenticate } from '../plugins/authenticate.js';
import {
  corridaPoolCreateSchema, corridaPoolEnvelopeSchema, corridasPoolEnvelopeSchema, costoRealPoolCreateSchema,
  costoRealPoolEnvelopeSchema, costosRealesPoolEnvelopeSchema, costosRealesPoolQuerySchema,
  poolIndirectoCreateSchema, poolIndirectoEnvelopeSchema,
} from '../../../shared/schemas/pool-indirecto.schema.js';

const companyParams = z.object({ companyId: z.string().uuid() });
const idParams = z.object({ id: z.string().uuid() });
const actorFrom = (request: FastifyRequest) => ({ id: request.authUser!.id, role: request.authUser!.role, jobTitle: request.authUser!.jobTitle, area: 'costista', method: 'manual', device: `${request.headers['user-agent'] ?? 'desconocido'} · ${request.ip}` });

export async function registerPoolIndirectoRoutes(app: FastifyInstance): Promise<void> {
  app.setSerializerCompiler(serializerCompiler); app.setValidatorCompiler(validatorCompiler);
  const contract = app.withTypeProvider<ZodTypeProvider>(); const service = new PoolIndirectoService();
  contract.post('/companies/:companyId/pools-indirectos', { preHandler: authenticate, schema: { body: poolIndirectoCreateSchema, response: { 201: poolIndirectoEnvelopeSchema, ...apiErrorResponses } } }, async (request, reply) => {
    const { companyId } = companyParams.parse(request.params);
    return reply.code(201).send(poolIndirectoEnvelopeSchema.parse({ data: await service.createPool(request.authUser!.id, companyId, poolIndirectoCreateSchema.parse(request.body), actorFrom(request)) }));
  });
  contract.post('/pools-indirectos/:id/costos-reales', { preHandler: authenticate, schema: { body: costoRealPoolCreateSchema, response: { 201: costoRealPoolEnvelopeSchema, ...apiErrorResponses } } }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    return reply.code(201).send(costoRealPoolEnvelopeSchema.parse({ data: await service.createActual(request.authUser!.id, id, costoRealPoolCreateSchema.parse(request.body), actorFrom(request)) }));
  });
  contract.get('/pools-indirectos/:id/costos-reales', { preHandler: authenticate, schema: { querystring: costosRealesPoolQuerySchema, response: { 200: costosRealesPoolEnvelopeSchema, ...apiErrorResponses } } }, async (request) => {
    const { id } = idParams.parse(request.params); const { periodo } = costosRealesPoolQuerySchema.parse(request.query);
    return costosRealesPoolEnvelopeSchema.parse({ data: await service.listActuals(request.authUser!.id, id, periodo) });
  });
  contract.post('/pools-indirectos/:id/corridas', { preHandler: authenticate, schema: { body: corridaPoolCreateSchema, response: { 201: corridaPoolEnvelopeSchema, ...apiErrorResponses } } }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    return reply.code(201).send(corridaPoolEnvelopeSchema.parse({ data: await service.run(request.authUser!.id, id, corridaPoolCreateSchema.parse(request.body), actorFrom(request)) }));
  });
  contract.get('/pools-indirectos/:id/corridas', { preHandler: authenticate, schema: { response: { 200: corridasPoolEnvelopeSchema, ...apiErrorResponses } } }, async (request) => {
    const { id } = idParams.parse(request.params); return corridasPoolEnvelopeSchema.parse({ data: await service.listRuns(request.authUser!.id, id) });
  });
}
