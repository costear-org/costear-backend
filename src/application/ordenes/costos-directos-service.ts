import type { CategoriaCostoDirectoOrden, EstadoValidacionOrden, PoliticaRetrabajo, PrismaClient, TipoEventoContingencia } from '@prisma/client';
import { prisma, withTenant } from '../../infrastructure/database/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors/domain-error.js';
import { recordTraceAudit, type TraceActor } from '../audit/trace-audit.js';
import type { ContingenciaCreateInput, CostoDirectoCreateInput } from '../../shared/schemas/costos-directos.schema.js';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
interface CostoRow { id: string; ordenId: string; etapaId: string; categoria: CategoriaCostoDirectoOrden; importe: unknown; documento?: string | null; periodoImputado: Date | string; estadoValidacion: EstadoValidacionOrden; motivoRechazo?: string | null }
interface EventoRow { id: string; ordenId: string; etapaId: string; tipo: TipoEventoContingencia; cantidad: unknown; unidad?: { id: string; nombre: string; codigo: string } | null; valor: unknown; recupero: unknown; causa: string; tratamiento: string; politicaRetrabajo?: PoliticaRetrabajo | null; estadoValidacion: EstadoValidacionOrden; motivoRechazo?: string | null }
const costo = (row: CostoRow) => ({ id: row.id, ordenId: row.ordenId, etapaId: row.etapaId, categoria: row.categoria, importe: Number(row.importe), documento: row.documento ?? null, periodoImputado: row.periodoImputado instanceof Date ? row.periodoImputado.toISOString().slice(0, 10) : row.periodoImputado, estadoValidacion: row.estadoValidacion, motivoRechazo: row.motivoRechazo ?? null, impactaCosto: row.estadoValidacion === 'VALIDADO' });
const evento = (row: EventoRow) => ({ id: row.id, ordenId: row.ordenId, etapaId: row.etapaId, tipo: row.tipo, cantidad: Number(row.cantidad), unidad: row.unidad ? { id: row.unidad.id, nombre: row.unidad.nombre, simbolo: row.unidad.codigo } : null, valor: Number(row.valor), recupero: row.recupero == null ? null : Number(row.recupero), causa: row.causa, tratamiento: row.tratamiento, politicaRetrabajo: row.politicaRetrabajo ?? null, estadoValidacion: row.estadoValidacion, motivoRechazo: row.motivoRechazo ?? null });

export class CostosDirectosService {
  constructor(private readonly db: PrismaClient = prisma) {}

  private async contexto(userId: string, ordenId: string, etapaId: string) {
    const orden = await withTenant(userId, (tx) => tx.ordenTrabajo.findFirst({ where: { id: ordenId, userId }, include: { company: { select: { politicaRetrabajo: true } } } }));
    if (!orden) throw new NotFoundError('Orden de trabajo no encontrada');
    const etapa = await withTenant(userId, (tx) => tx.etapaOrden.findFirst({ where: { id: etapaId, ordenId, userId } }));
    if (!etapa) throw new NotFoundError('Etapa de la orden no encontrada');
    return { orden, etapa };
  }

  async createCosto(userId: string, ordenId: string, input: CostoDirectoCreateInput, actor: TraceActor) {
    await this.contexto(userId, ordenId, input.etapaId);
    return withTenant(userId, async (tx) => {
      const creado = await tx.costoDirectoOrden.create({ data: { ordenId, etapaId: input.etapaId, userId, categoria: input.categoria, importe: input.importe, documento: input.documento ?? null, periodoImputado: date(input.periodoImputado) } });
      await recordTraceAudit({ entityType: 'CostoDirectoOrden', entityId: creado.id, action: 'create', actor, after: creado }, tx);
      return costo(creado);
    });
  }

  async listCostos(userId: string, ordenId: string) {
    const orden = await withTenant(userId, (tx) => tx.ordenTrabajo.findFirst({ where: { id: ordenId, userId }, select: { id: true } }));
    if (!orden) throw new NotFoundError('Orden de trabajo no encontrada');
    const rows = await withTenant(userId, (tx) => tx.costoDirectoOrden.findMany({ where: { ordenId, userId }, include: { etapa: { select: { esEntrega: true } } }, orderBy: [{ periodoImputado: 'asc' }, { createdAt: 'asc' }] }));
    const data = rows.map(costo);
    return { data, resumen: { totalValidado: data.filter((x) => x.impactaCosto).reduce((sum, x) => sum + x.importe, 0), entregaInstalacionValidada: rows.filter((x) => x.estadoValidacion === 'VALIDADO' && x.etapa.esEntrega).reduce((sum, x) => sum + Number(x.importe), 0) } };
  }

  async createContingencia(userId: string, ordenId: string, input: ContingenciaCreateInput, actor: TraceActor) {
    const { orden } = await this.contexto(userId, ordenId, input.etapaId);
    const unidadId = input.unidadId ?? null;
    const unidad = unidadId ? await withTenant(userId, (tx) => tx.unidadMedida.findFirst({ where: { id: unidadId, companyId: orden.companyId, userId, deletedAt: null } })) : null;
    if (unidadId && !unidad) throw new ValidationError('La unidad de medida no pertenece a la empresa');
    const politica = input.tipo === 'RETRABAJO' ? orden.company.politicaRetrabajo : null;
    let estadoValidacion: 'PENDIENTE' | 'MARCADO' = 'PENDIENTE';
    if (politica === 'CAMBIO_CLIENTE') {
      const adicional = input.versionPresupuestoId ? await withTenant(userId, (tx) => tx.versionPresupuesto.findFirst({ where: { id: input.versionPresupuestoId!, ordenId, userId, tipo: 'ADICIONAL', estado: 'APROBADO' } })) : null;
      if (!adicional) estadoValidacion = 'MARCADO';
    }
    return withTenant(userId, async (tx) => {
      const creado = await tx.eventoContingencia.create({ data: { ordenId, etapaId: input.etapaId, userId, tipo: input.tipo, cantidad: input.cantidad, unidadId: input.unidadId ?? null, valor: input.valor, recupero: input.recupero ?? null, causa: input.causa, tratamiento: input.tratamiento, politicaRetrabajo: politica, versionPresupuestoId: input.versionPresupuestoId ?? null, estadoValidacion }, include: { unidad: { select: { id: true, nombre: true, codigo: true } } } });
      await recordTraceAudit({ entityType: 'EventoContingencia', entityId: creado.id, action: 'create', actor, after: creado }, tx);
      return evento(creado);
    });
  }

  async listContingencias(userId: string, ordenId: string) {
    const orden = await withTenant(userId, (tx) => tx.ordenTrabajo.findFirst({ where: { id: ordenId, userId }, select: { id: true } }));
    if (!orden) throw new NotFoundError('Orden de trabajo no encontrada');
    const rows = await withTenant(userId, (tx) => tx.eventoContingencia.findMany({ where: { ordenId, userId }, include: { unidad: { select: { id: true, nombre: true, codigo: true } } }, orderBy: { createdAt: 'asc' } }));
    const data = rows.map(evento);
    const total = (policy: PoliticaRetrabajo) => data.reduce((sum, item, index) => {
      const row = rows[index]!;
      return row.estadoValidacion === 'VALIDADO' && row.tipo === 'RETRABAJO' && row.politicaRetrabajo === policy
        ? sum + item.valor - (item.recupero ?? 0)
        : sum;
    }, 0);
    return { data, resumen: { perdidaPeriodoValidada: total('PERDIDA_PERIODO'), cifPoolValidado: total('CIF_POOL'), adicionalValidado: total('CAMBIO_CLIENTE') } };
  }

  private async transitionCosto(userId: string, id: string, estado: 'VALIDADO' | 'RECHAZADO', actor: TraceActor, motivoRechazo: string | null = null) {
    return withTenant(userId, async (tx) => {
      const actual = await tx.costoDirectoOrden.findFirst({ where: { id, userId }, include: { orden: { select: { estado: true } } } });
      if (!actual) throw new NotFoundError('Costo directo no encontrado');
      if (actual.orden.estado === 'CERRADA') throw new ConflictError('La orden cerrada no admite validaciones');
      const permitidos = estado === 'VALIDADO' ? ['PENDIENTE'] : ['PENDIENTE', 'MARCADO'];
      if (!permitidos.includes(actual.estadoValidacion)) throw new ConflictError('El costo directo ya fue resuelto');
      const actualizado = await tx.costoDirectoOrden.update({ where: { id }, data: { estadoValidacion: estado, motivoRechazo } });
      await recordTraceAudit({ entityType: 'CostoDirectoOrden', entityId: id, action: estado === 'VALIDADO' ? 'validate' : 'reject', actor, before: actual, after: actualizado, comment: motivoRechazo ?? undefined }, tx);
      return costo(actualizado);
    });
  }

  validateCosto(userId: string, id: string, actor: TraceActor) { return this.transitionCosto(userId, id, 'VALIDADO', actor); }
  rejectCosto(userId: string, id: string, motivo: string, actor: TraceActor) { return this.transitionCosto(userId, id, 'RECHAZADO', actor, motivo); }

  private async transitionContingencia(userId: string, id: string, estado: 'VALIDADO' | 'RECHAZADO', actor: TraceActor, motivoRechazo: string | null = null) {
    return withTenant(userId, async (tx) => {
      const actual = await tx.eventoContingencia.findFirst({ where: { id, userId }, include: { orden: { select: { estado: true } } } });
      if (!actual) throw new NotFoundError('Contingencia no encontrada');
      if (actual.orden.estado === 'CERRADA') throw new ConflictError('La orden cerrada no admite validaciones');
      const permitidos = estado === 'VALIDADO' ? ['PENDIENTE'] : ['PENDIENTE', 'MARCADO'];
      if (!permitidos.includes(actual.estadoValidacion)) throw new ConflictError('La contingencia ya fue resuelta');
      const actualizado = await tx.eventoContingencia.update({ where: { id }, data: { estadoValidacion: estado, motivoRechazo }, include: { unidad: { select: { id: true, nombre: true, codigo: true } } } });
      await recordTraceAudit({ entityType: 'EventoContingencia', entityId: id, action: estado === 'VALIDADO' ? 'validate' : 'reject', actor, before: actual, after: actualizado, comment: motivoRechazo ?? undefined }, tx);
      return evento(actualizado);
    });
  }

  validateContingencia(userId: string, id: string, actor: TraceActor) { return this.transitionContingencia(userId, id, 'VALIDADO', actor); }
  rejectContingencia(userId: string, id: string, motivo: string, actor: TraceActor) { return this.transitionContingencia(userId, id, 'RECHAZADO', actor, motivo); }
}
