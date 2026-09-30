import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { PersonalService } from '../../../application/ordenes/personal-service.js';
import { OperatorScopeService } from '../../../application/empresa/operator-scope-service.js';
import { authenticate, requireRole } from '../plugins/authenticate.js';
import { apiErrorResponses } from '../../../shared/schemas/api-contract.schema.js';
import {
  categoriaPersonalCreateSchema, categoriaPersonalEnvelopeSchema, categoriasPersonalEnvelopeSchema,
  personaCreateSchema, personaEnvelopeSchema, personasEnvelopeSchema, personaUpdateSchema,
  tarifaManoObraCreateSchema, tarifaManoObraEnvelopeSchema, tarifasManoObraEnvelopeSchema,
} from '../../../shared/schemas/personal.schema.js';

const companyParams = z.object({ companyId: z.string().uuid() });
const idParams = z.object({ id: z.string().uuid() });
const adminOnly = [authenticate, requireRole('EMPRESA_ADMIN', 'EMPRESARIO')];
const actorFrom = (request: FastifyRequest) => ({
  id: request.authUser!.id, role: request.authUser!.role, jobTitle: request.authUser!.jobTitle,
  area: 'costista', method: 'manual', device: `${request.headers['user-agent'] ?? 'desconocido'} · ${request.ip}`,
});

export async function registerPersonalRoutes(app: FastifyInstance): Promise<void> {
  app.setSerializerCompiler(serializerCompiler); app.setValidatorCompiler(validatorCompiler);
  const contract = app.withTypeProvider<ZodTypeProvider>();
  const service = new PersonalService(); const scopes = new OperatorScopeService();

  contract.get('/companies/:companyId/categorias-personal', { preHandler: adminOnly, schema: { response: { 200: categoriasPersonalEnvelopeSchema, ...apiErrorResponses } } }, async (request) => {
    const { companyId } = companyParams.parse(request.params); return { data: await service.listCategories(request.authUser!.id, companyId) };
  });
  contract.post('/companies/:companyId/categorias-personal', { preHandler: adminOnly, schema: { body: categoriaPersonalCreateSchema, response: { 201: categoriaPersonalEnvelopeSchema, ...apiErrorResponses } } }, async (request, reply) => {
    const { companyId } = companyParams.parse(request.params); return reply.code(201).send({ data: await service.createCategory(request.authUser!.id, companyId, request.body, actorFrom(request)) });
  });
  contract.get('/companies/:companyId/personas', { preHandler: authenticate, schema: { response: { 200: personasEnvelopeSchema, ...apiErrorResponses } } }, async (request) => {
    const { companyId } = companyParams.parse(request.params);
    const tenantId = request.authUser!.role === 'EMPRESA_OPERATOR'
      ? await scopes.tenantForCompanyAny(request.authUser!.id, companyId, ['horas.cargar', 'horas.aprobar'])
      : request.authUser!.id;
    return { data: await service.listPeople(tenantId, companyId) };
  });
  contract.post('/companies/:companyId/personas', { preHandler: adminOnly, schema: { body: personaCreateSchema, response: { 201: personaEnvelopeSchema, ...apiErrorResponses } } }, async (request, reply) => {
    const { companyId } = companyParams.parse(request.params); return reply.code(201).send({ data: await service.createPerson(request.authUser!.id, companyId, request.body, actorFrom(request)) });
  });
  contract.patch('/personas/:id', { preHandler: adminOnly, schema: { body: personaUpdateSchema, response: { 200: personaEnvelopeSchema, ...apiErrorResponses } } }, async (request) => {
    const { id } = idParams.parse(request.params); return { data: await service.updatePerson(request.authUser!.id, id, request.body, actorFrom(request)) };
  });
  contract.get('/companies/:companyId/tarifas-mano-obra', { preHandler: adminOnly, schema: { response: { 200: tarifasManoObraEnvelopeSchema, ...apiErrorResponses } } }, async (request) => {
    const { companyId } = companyParams.parse(request.params); return { data: await service.listRates(request.authUser!.id, companyId) };
  });
  contract.post('/companies/:companyId/tarifas-mano-obra', { preHandler: adminOnly, schema: { body: tarifaManoObraCreateSchema, response: { 201: tarifaManoObraEnvelopeSchema, ...apiErrorResponses } } }, async (request, reply) => {
    const { companyId } = companyParams.parse(request.params); return reply.code(201).send({ data: await service.createRate(request.authUser!.id, companyId, request.body, actorFrom(request)) });
  });
}
