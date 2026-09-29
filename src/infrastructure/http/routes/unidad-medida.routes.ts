import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { UnidadMedidaService } from '../../../application/operacion/unidad-medida-service.js';
import { authenticate, requireRole } from '../plugins/authenticate.js';
import { apiErrorResponses } from '../../../shared/schemas/api-contract.schema.js';
import { unidadMedidaCreateSchema, unidadMedidaEnvelopeSchema, unidadMedidaUpdateSchema, unidadesMedidaEnvelopeSchema } from '../../../shared/schemas/unidad-medida.schema.js';
import { OperatorScopeService } from '../../../application/empresa/operator-scope-service.js';

const companyParams = z.object({ companyId: z.string().uuid() });
const unitParams = z.object({ id: z.string().uuid() });
const actor = (request: FastifyRequest) => ({ id: request.authUser!.id, role: request.authUser!.role, jobTitle: request.authUser!.jobTitle, area: 'costista', method: 'manual', device: `${request.headers['user-agent'] ?? 'desconocido'} · ${request.ip}` });

export async function registerUnidadMedidaRoutes(app: FastifyInstance): Promise<void> {
  app.setSerializerCompiler(serializerCompiler); app.setValidatorCompiler(validatorCompiler);
  const contract = app.withTypeProvider<ZodTypeProvider>(); const service = new UnidadMedidaService(); const scopes = new OperatorScopeService();
  contract.post('/companies/:companyId/unidades-medida', { preHandler: [authenticate, requireRole('EMPRESA_ADMIN', 'EMPRESARIO')], schema: { body: unidadMedidaCreateSchema, response: { 201: unidadMedidaEnvelopeSchema, ...apiErrorResponses } } }, async (request, reply) => {
    const { companyId } = companyParams.parse(request.params); return reply.code(201).send({ data: await service.create(request.authUser!.id, companyId, request.body, actor(request)) });
  });
  contract.get('/companies/:companyId/unidades-medida', { preHandler: authenticate, schema: { response: { 200: unidadesMedidaEnvelopeSchema, ...apiErrorResponses } } }, async (request) => {
    const { companyId } = companyParams.parse(request.params); const userId = request.authUser!.role === 'EMPRESA_OPERATOR' ? await scopes.tenantForCompanyAccess(request.authUser!.id, companyId) : request.authUser!.id; return { data: await service.list(userId, companyId) };
  });
  contract.patch('/unidades-medida/:id', { preHandler: [authenticate, requireRole('EMPRESA_ADMIN', 'EMPRESARIO')], schema: { body: unidadMedidaUpdateSchema, response: { 200: unidadMedidaEnvelopeSchema, ...apiErrorResponses } } }, async (request) => {
    const { id } = unitParams.parse(request.params); return { data: await service.update(request.authUser!.id, id, request.body, actor(request)) };
  });
  contract.delete('/unidades-medida/:id', { preHandler: [authenticate, requireRole('EMPRESA_ADMIN', 'EMPRESARIO')], schema: { response: { 204: z.null(), ...apiErrorResponses } } }, async (request, reply) => {
    const { id } = unitParams.parse(request.params); await service.remove(request.authUser!.id, id, actor(request)); return reply.code(204).send(null);
  });
}
