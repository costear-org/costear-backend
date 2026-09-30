import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { ForbiddenError, NotFoundError } from '../../domain/errors/domain-error.js';
import { recordTraceAudit, type TraceActor } from '../audit/trace-audit.js';
import { CATEGORY_BY_INDUSTRY, PAQUETE_AVICOLA_POSTURA } from '../operacion/paquete-avicola.js';
import { CATEGORIA_CONSTRUCCION_MODULAR, PAQUETE_CONSTRUCCION_MODULAR } from '../operacion/paquete-construccion-modular.js';

export interface OperatorScopeInput {
  unidadProductivaIds: string[];
  depositoIds: string[];
  ordenTrabajoIds: string[];
  permisos: string[];
}

export const PERMISOS_OPERADOR = [
  'ordenes.ver', 'ordenes.editar', 'ordenes.ver_margen', 'ordenes.aprobar_presupuesto',
  'ordenes.cerrar', 'inventario.mover', 'horas.cargar', 'horas.aprobar',
] as const;
export type PermisoOperador = typeof PERMISOS_OPERADOR[number];
export const esPermisoOperador = (value: string): value is PermisoOperador =>
  (PERMISOS_OPERADOR as readonly string[]).includes(value);

type TipoEntidadOperativa = 'UnidadProductiva' | 'Deposito';
interface AccionCargaPaquete {
  moduloId: string;
  clave: string;
  nombre: string;
  descripcion: string;
  superficie: string;
  destino: string;
  entidadDestino: TipoEntidadOperativa;
  permiso?: PermisoOperador;
}

function esAccionCarga(value: unknown): value is AccionCargaPaquete {
  if (!value || typeof value !== 'object') return false;
  const action = value as Partial<AccionCargaPaquete>;
  return typeof action.moduloId === 'string' && typeof action.clave === 'string' && typeof action.nombre === 'string' &&
    typeof action.descripcion === 'string' && typeof action.superficie === 'string' &&
    typeof action.destino === 'string' &&
    (action.entidadDestino === 'UnidadProductiva' || action.entidadDestino === 'Deposito') &&
    (action.permiso === undefined || esPermisoOperador(action.permiso));
}

const paqueteCanonico = (category: string) => {
  if (category === 'AVICOLA_POSTURA') return PAQUETE_AVICOLA_POSTURA;
  if (category === CATEGORIA_CONSTRUCCION_MODULAR) return PAQUETE_CONSTRUCCION_MODULAR;
  return undefined;
};

export class OperatorScopeService {
  constructor(private readonly db: PrismaClient = prisma) {}

  private async paquete(userId: string, companyId: string, industry: string | null) {
    const category = industry
      ? CATEGORY_BY_INDUSTRY[industry as keyof typeof CATEGORY_BY_INDUSTRY] ?? industry
      : undefined;
    if (!category) return {
      lexicon: {} as Record<string, unknown>,
      accionesCarga: [] as AccionCargaPaquete[],
      defaults: new Map<string, boolean>(),
    };
    const rows = await this.db.paqueteRubro.findMany({
      where: {
        category,
        OR: [{ userId: null }, { userId }],
        AND: [{ OR: [{ companyId: null }, { companyId }] }, { structureId: null }, { periodId: null }],
      },
    });
    const rank = (row: { companyId?: string | null; userId?: string | null }) =>
      (row.companyId ? 2 : 0) + (row.userId ? 1 : 0);
    const resolved = [...rows].sort((a, b) => rank(a) - rank(b)).reduce<Record<string, unknown>>((result, row) => {
      const next = { ...result, lexicon: row.lexicon, modulos: row.modulos };
      return row.access === null ? next : { ...next, access: row.access };
    }, {});
    const canonical = paqueteCanonico(category);
    const lexicon = (resolved.lexicon ?? canonical?.lexicon ?? {}) as Record<string, unknown>;
    const access = resolved.access && typeof resolved.access === 'object' && !Array.isArray(resolved.access)
      ? resolved.access as Record<string, unknown>
      : {};
    const canonicalAccess = canonical?.access as { actions?: readonly unknown[] } | undefined;
    const declared = Array.isArray(access.actions) ? access.actions.filter(esAccionCarga) : [];
    const fallback = canonicalAccess?.actions?.filter(esAccionCarga) ?? [];
    const modulos = Array.isArray(resolved.modulos) ? resolved.modulos : canonical?.modulos ?? [];
    const defaults = new Map(modulos.flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const modulo = value as { clave?: unknown; activoPorDefecto?: unknown };
      return typeof modulo.clave === 'string' && typeof modulo.activoPorDefecto === 'boolean'
        ? [[modulo.clave, modulo.activoPorDefecto] as const]
        : [];
    }));
    return { lexicon, accionesCarga: declared.length ? declared : fallback, defaults };
  }

  async listAssignableEntities(companyId: string, administratorId: string) {
    const company = await this.db.company.findFirst({
      where: { id: companyId, userId: administratorId, isActive: true },
      select: { id: true, industry: true },
    });
    if (!company) throw new NotFoundError('Negocio no encontrado');
    const [unidades, depositos, paquete] = await Promise.all([
      this.db.unidadProductiva.findMany({
        where: { companyId, activa: true, deletedAt: null }, select: { id: true, referencia: true }, orderBy: { referencia: 'asc' },
      }),
      this.db.deposito.findMany({
        where: { companyId, deletedAt: null }, select: { id: true, referencia: true }, orderBy: { referencia: 'asc' },
      }),
      this.paquete(administratorId, companyId, company.industry),
    ]);
    const unidadLabel = typeof paquete.lexicon.UnidadProductiva === 'string' ? paquete.lexicon.UnidadProductiva : 'Unidad productiva';
    const depositoLabel = typeof paquete.lexicon.Deposito === 'string' ? paquete.lexicon.Deposito : 'Depósito';
    return {
      unidadesProductivas: unidades.map((item) => ({ ...item, etiqueta: unidadLabel })),
      depositos: depositos.map((item) => ({ ...item, etiqueta: depositoLabel })),
    };
  }

  async listOperationalCatalog(operatorId: string, connectionId: string) {
    const membership = await this.db.operatorMembership.findFirst({
      where: { operatorId, connectionId, isActive: true },
      select: {
        permisos: true,
        connection: { select: { id: true, costistId: true, companyId: true, company: { select: { industry: true } } } },
        unidadesAutorizadas: { select: { unidadProductiva: { select: { id: true, referencia: true } } } },
        depositosAutorizados: { select: { deposito: { select: { id: true, referencia: true } } } },
      },
    });
    if (!membership) throw new NotFoundError('Conexión de empresa no encontrada');
    if (!membership.unidadesAutorizadas.length && !membership.depositosAutorizados.length) {
      return {
        estado: 'sin_entidades_autorizadas' as const,
        mensaje: 'Todavía no te asignaron ninguna entidad para cargar datos.',
        acciones: [],
      };
    }
    const paquete = await this.paquete(
      membership.connection.costistId,
      membership.connection.companyId,
      membership.connection.company.industry,
    );
    const configuraciones = await this.db.configuracionModuloRubro.findMany({
      where: { companyId: membership.connection.companyId }, select: { moduleId: true, activo: true },
    });
    const estados = new Map(configuraciones.map((item) => [item.moduleId, item.activo]));
    const accionesActivas = paquete.accionesCarga.filter((action) => {
      const activo = estados.get(action.moduloId) ?? paquete.defaults.get(action.moduloId) ?? false;
      return activo && (!action.permiso || membership.permisos.includes(action.permiso));
    });
    const labels: Record<TipoEntidadOperativa, string> = {
      UnidadProductiva: typeof paquete.lexicon.UnidadProductiva === 'string' ? paquete.lexicon.UnidadProductiva : 'Unidad productiva',
      Deposito: typeof paquete.lexicon.Deposito === 'string' ? paquete.lexicon.Deposito : 'Depósito',
    };
    const entidades = {
      UnidadProductiva: membership.unidadesAutorizadas.map((item) => item.unidadProductiva),
      Deposito: membership.depositosAutorizados.map((item) => item.deposito),
    };
    const acciones = accionesActivas.flatMap((action) => entidades[action.entidadDestino].map((entidad) => ({
      clave: action.clave,
      nombre: action.nombre,
      descripcion: action.descripcion,
      superficie: action.superficie,
      destino: action.destino,
      entidad: { tipo: action.entidadDestino, ...entidad, etiqueta: labels[action.entidadDestino] },
    })));
    return { estado: 'disponible' as const, mensaje: null, acciones };
  }

  async assertUnidad(operatorId: string, unidadProductivaId: string, actor?: TraceActor): Promise<void> {
    const allowed = await this.db.operatorUnidadProductiva.findFirst({
      where: { unidadProductivaId, membership: { operatorId, isActive: true } },
      select: { membershipId: true },
    });
    if (!allowed) {
      if (actor) await recordTraceAudit({ entityType: 'UnidadProductiva', entityId: unidadProductivaId, action: 'scope.denied', actor, comment: 'Intento de carga fuera del alcance autorizado' }, this.db);
      throw new ForbiddenError('No tenés autorización para cargar datos de esa unidad productiva.');
    }
  }

  async assertDeposito(operatorId: string, depositoId: string, actor?: TraceActor): Promise<void> {
    const allowed = await this.db.operatorDeposito.findFirst({
      where: { depositoId, membership: { operatorId, isActive: true } },
      select: { membershipId: true },
    });
    if (!allowed) {
      if (actor) await recordTraceAudit({ entityType: 'Deposito', entityId: depositoId, action: 'scope.denied', actor, comment: 'Intento de carga fuera del alcance autorizado' }, this.db);
      throw new ForbiddenError('No tenés autorización para cargar datos de ese depósito.');
    }
  }

  async tenantForDeposito(operatorId: string, depositoId: string, permission: PermisoOperador): Promise<string> {
    const allowed = await this.db.operatorDeposito.findFirst({
      where: { depositoId, membership: { operatorId, isActive: true, permisos: { has: permission } } },
      select: { membership: { select: { connection: { select: { costistId: true } } } } },
    });
    if (!allowed) throw new ForbiddenError('No tenés autorización para acceder a ese depósito.');
    return allowed.membership.connection.costistId;
  }

  async assertPermission(operatorId: string, permission: PermisoOperador): Promise<void> {
    const membership = await this.db.operatorMembership.findFirst({
      where: { operatorId, isActive: true, permisos: { has: permission } }, select: { id: true },
    });
    if (!membership) throw new ForbiddenError('No tenés permisos para esta acción.');
  }

  async tenantForCompany(operatorId: string, companyId: string, permission: PermisoOperador): Promise<string> {
    const membership = await this.db.operatorMembership.findFirst({
      where: { operatorId, isActive: true, permisos: { has: permission }, connection: { companyId } },
      select: { connection: { select: { costistId: true } } },
    });
    if (!membership) throw new ForbiddenError('No tenés permisos para esta acción.');
    return membership.connection.costistId;
  }

  async tenantForCompanyAny(operatorId: string, companyId: string, permissions: PermisoOperador[]): Promise<string> {
    const membership = await this.db.operatorMembership.findFirst({
      where: { operatorId, isActive: true, permisos: { hasSome: permissions }, connection: { companyId } },
      select: { connection: { select: { costistId: true } } },
    });
    if (!membership) throw new ForbiddenError('No tenés permisos para esta acción.');
    return membership.connection.costistId;
  }

  async tenantForCompanyAccess(operatorId: string, companyId: string): Promise<string> {
    const membership = await this.db.operatorMembership.findFirst({
      where: { operatorId, isActive: true, connection: { companyId } },
      select: { connection: { select: { costistId: true } } },
    });
    if (!membership) throw new ForbiddenError('No tenés acceso a ese negocio.');
    return membership.connection.costistId;
  }

  async tenantForOrden(operatorId: string, ordenId: string, permission: PermisoOperador): Promise<string> {
    const allowed = await this.db.operatorOrdenTrabajo.findFirst({
      where: { ordenId, membership: { operatorId, isActive: true, permisos: { has: permission } } },
      select: { orden: { select: { userId: true } } },
    });
    if (!allowed) throw new ForbiddenError('No tenés autorización para acceder a esa orden de trabajo.');
    return allowed.orden.userId;
  }

  async tenantForPresupuesto(operatorId: string, presupuestoId: string, permission: PermisoOperador): Promise<string> {
    const allowed = await this.db.versionPresupuesto.findFirst({
      where: { id: presupuestoId, orden: { operadoresAutorizados: { some: { membership: { operatorId, isActive: true, permisos: { has: permission } } } } } },
      select: { userId: true },
    });
    if (!allowed) throw new ForbiddenError('No tenés autorización para acceder a ese presupuesto.');
    return allowed.userId;
  }

  async tenantForParteHoras(operatorId: string, parteId: string, permission: PermisoOperador): Promise<string> {
    const allowed = await this.db.parteHoras.findFirst({
      where: { id: parteId, orden: { operadoresAutorizados: { some: { membership: { operatorId, isActive: true, permisos: { has: permission } } } } } },
      select: { userId: true },
    });
    if (!allowed) throw new ForbiddenError('No tenés autorización para acceder a ese parte de horas.');
    return allowed.userId;
  }

  async ordenIds(operatorId: string, companyId: string): Promise<string[]> {
    const rows = await this.db.operatorOrdenTrabajo.findMany({
      where: { orden: { companyId }, membership: { operatorId, isActive: true, permisos: { has: 'ordenes.ver' } } },
      select: { ordenId: true },
    });
    return rows.map((row) => row.ordenId);
  }

  async assertOrden(operatorId: string, ordenId: string, permission: PermisoOperador): Promise<void> {
    const allowed = await this.db.operatorOrdenTrabajo.findFirst({
      where: {
        ordenId,
        membership: { operatorId, isActive: true, permisos: { has: permission } },
      },
      select: { membershipId: true },
    });
    if (!allowed) throw new ForbiddenError('No tenés autorización para acceder a esa orden de trabajo.');
  }

  async assertLote(operatorId: string, loteId: string, actor?: TraceActor): Promise<void> {
    const lote = await this.db.loteProductivo.findUnique({ where: { id: loteId }, select: { unidadProductivaId: true } });
    if (!lote?.unidadProductivaId) {
      if (actor) await recordTraceAudit({ entityType: 'LoteProductivo', entityId: loteId, action: 'scope.denied', actor, comment: 'El lote no tiene unidad productiva autorizable' }, this.db);
      throw new ForbiddenError('El lote no está asociado a una unidad productiva autorizada.');
    }
    await this.assertUnidad(operatorId, lote.unidadProductivaId, actor);
  }

  async replace(
    companyId: string,
    operatorId: string,
    administratorId: string,
    input: OperatorScopeInput,
    actor: TraceActor,
  ): Promise<void> {
    const membership = await this.db.operatorMembership.findFirst({
      where: { operatorId, connection: { companyId, company: { userId: administratorId } } },
      include: { unidadesAutorizadas: true, depositosAutorizados: true, ordenesAutorizadas: true },
    });
    // 404 evita confirmar operadores o empresas de otro tenant.
    if (!membership) throw new NotFoundError('Cargador no encontrado');

    const [units, deposits, orders] = await Promise.all([
      this.db.unidadProductiva.count({ where: { id: { in: input.unidadProductivaIds }, companyId, deletedAt: null } }),
      this.db.deposito.count({ where: { id: { in: input.depositoIds }, companyId, deletedAt: null } }),
      this.db.ordenTrabajo.count({ where: { id: { in: input.ordenTrabajoIds }, companyId } }),
    ]);
    if (units !== new Set(input.unidadProductivaIds).size || deposits !== new Set(input.depositoIds).size || orders !== new Set(input.ordenTrabajoIds).size) {
      throw new NotFoundError('Una o más entidades autorizadas no pertenecen a la empresa');
    }

    const before = {
      unidadProductivaIds: membership.unidadesAutorizadas.map((x) => x.unidadProductivaId),
      depositoIds: membership.depositosAutorizados.map((x) => x.depositoId),
      ordenTrabajoIds: membership.ordenesAutorizadas.map((x) => x.ordenId),
      permisos: membership.permisos,
    };
    await this.db.$transaction(async (tx) => {
      await tx.operatorUnidadProductiva.deleteMany({ where: { membershipId: membership.id } });
      await tx.operatorDeposito.deleteMany({ where: { membershipId: membership.id } });
      await tx.operatorOrdenTrabajo.deleteMany({ where: { membershipId: membership.id } });
      if (input.unidadProductivaIds.length) {
        await tx.operatorUnidadProductiva.createMany({
          data: [...new Set(input.unidadProductivaIds)].map((unidadProductivaId) => ({ membershipId: membership.id, unidadProductivaId })),
        });
      }
      if (input.depositoIds.length) {
        await tx.operatorDeposito.createMany({
          data: [...new Set(input.depositoIds)].map((depositoId) => ({ membershipId: membership.id, depositoId })),
        });
      }
      if (input.ordenTrabajoIds.length) {
        await tx.operatorOrdenTrabajo.createMany({
          data: [...new Set(input.ordenTrabajoIds)].map((ordenId) => ({ membershipId: membership.id, ordenId })),
        });
      }
      await tx.operatorMembership.update({ where: { id: membership.id }, data: { permisos: [...new Set(input.permisos)] } });
      await recordTraceAudit({ entityType: 'OperatorMembership', entityId: membership.id, action: 'scope.update', actor, before, after: input }, tx as Prisma.TransactionClient);
    });
  }
}
