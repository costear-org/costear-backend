import type { Prisma, PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { ENGINE_VERSION } from '../../domain/calculations/calculate.js';
import { NotFoundError, UnprocessableEntityError, ValidationError } from '../../domain/errors/domain-error.js';
import { prisma, withTenant } from '../../infrastructure/database/prisma.js';
import type { ReaperturaOrdenInput } from '../../shared/schemas/cierre-orden.schema.js';
import { recordTraceAudit, type TraceActor } from '../audit/trace-audit.js';
import { InformeDesvioOrdenService } from './informe-desvio-orden-service.js';

class PendingItemsError extends UnprocessableEntityError { override readonly code = 'ORDER_CLOSE_PENDING_ITEMS'; }
class ReopenReasonError extends ValidationError { override readonly code = 'REOPEN_REASON_REQUIRED'; }
class InvalidCloseStateError extends ValidationError { override readonly code = 'INVALID_ORDER_CLOSE_STATE'; }

export class CierreOrdenService {
  constructor(private readonly db: PrismaClient = prisma) {}

  private async order(userId: string, ordenId: string) {
    const order = await withTenant(userId, (tx) => tx.ordenTrabajo.findFirst({
      where: { id: ordenId, userId },
      include: {
        presupuestos: true, partesHoras: true, costosDirectos: true, contingencias: true,
        aplicacionesIndirectos: { include: { corrida: { include: { pool: { select: { tipo: true } } } } } },
      },
    }));
    if (!order) throw new NotFoundError('Orden de trabajo no encontrada');
    return order;
  }

  async close(userId: string, ordenId: string, actor: TraceActor, motivoReapertura?: string) {
    const order = await this.order(userId, ordenId);
    if (order.estado !== 'PENDIENTE_CIERRE') throw new InvalidCloseStateError('La orden debe estar pendiente de cierre');
    const pendientes = [
      ...order.partesHoras.filter((x) => x.estado !== 'APROBADO').map((x) => ({ tipo: 'PARTE_HORAS', id: x.id })),
      ...order.costosDirectos.filter((x) => x.estadoValidacion === 'PENDIENTE').map((x) => ({ tipo: 'FACTURA_O_COSTO', id: x.id })),
      ...order.contingencias.filter((x) => x.estadoValidacion === 'PENDIENTE').map((x) => ({ tipo: 'CONTINGENCIA', id: x.id })),
      ...order.presupuestos.filter((x) => x.estado === 'BORRADOR' || x.estado === 'PREPARADO').map((x) => ({ tipo: 'CAMBIO_PRESUPUESTO', id: x.id })),
    ];
    if (pendientes.length) throw new PendingItemsError('No se puede cerrar: hay cargas pendientes de resolver', { pendientes });

    const informe = await new InformeDesvioOrdenService(this.db).get(userId, ordenId);
    const base = order.presupuestos.filter((x) => x.tipo === 'BASE' && x.estado === 'APROBADO');
    const adicionales = order.presupuestos.filter((x) => x.tipo === 'ADICIONAL' && x.estado === 'APROBADO');
    const gastosGerenciales = order.aplicacionesIndirectos
      .filter((x) => x.corrida.pool.tipo !== 'FABRIL')
      .reduce((sum, x) => sum.plus(x.importe.toString()), new Decimal(0)).toDecimalPlaces(2).toNumber();
    const frozen: Prisma.InputJsonValue = {
      presupuestoOriginal: base, adicionalesAprobados: adicionales,
      costoFabricacionReal: { elementos: informe.elementos.filter((x) => x.elemento !== 'ENTREGA'), variacionPresupuestoAsignada: informe.puente.filter((x) => x.causa === 'ASIGNACION') },
      entregaInstalacion: informe.elementos.filter((x) => x.elemento === 'ENTREGA'),
      gastosGerencialesAsignados: gastosGerenciales, precioContractual: informe.precioContractual,
      margen: { esperado: informe.margenEsperado, real: informe.margenReal },
      partidas: informe.elementos, causasDesvio: informe.puente,
    } as unknown as Prisma.InputJsonValue;
    const previous = await withTenant(userId, (tx) => tx.fotoCierreOrden.findFirst({ where: { ordenId, userId }, orderBy: { version: 'desc' } }));
    return withTenant(userId, async (tx) => {
      const photo = await tx.fotoCierreOrden.create({ data: {
        ordenId, userId, version: (previous?.version ?? 0) + 1, congelado: frozen,
        versionMotor: ENGINE_VERSION, cerradoPor: actor.id, motivoReapertura: motivoReapertura ?? null,
        anteriorId: previous?.id ?? null,
      } });
      await tx.ordenTrabajo.update({ where: { id: ordenId }, data: { estado: 'CERRADA', fechaCierre: new Date() } });
      await recordTraceAudit({ entityType: 'OrdenTrabajo', entityId: ordenId, action: 'close', actor, after: { fotoId: photo.id, version: photo.version } }, tx);
      return photo;
    });
  }

  async reopen(userId: string, ordenId: string, input: ReaperturaOrdenInput, actor: TraceActor) {
    const motivo = input.motivo.trim();
    if (!motivo) throw new ReopenReasonError('Para reabrir la orden hay que indicar un motivo');
    const order = await this.order(userId, ordenId);
    if (order.estado !== 'CERRADA') throw new InvalidCloseStateError('Sólo se puede reabrir una orden cerrada');
    await withTenant(userId, async (tx) => {
      const previous = await tx.fotoCierreOrden.findFirst({ where: { ordenId, userId }, orderBy: { version: 'desc' } });
      if (!previous) throw new InvalidCloseStateError('La orden cerrada no tiene una foto de cierre');
      const reopenedPhoto = await tx.fotoCierreOrden.create({ data: {
        ordenId, userId, version: previous.version + 1, congelado: previous.congelado as Prisma.InputJsonValue,
        versionMotor: previous.versionMotor, cerradoPor: actor.id, motivoReapertura: motivo, anteriorId: previous.id,
      } });
      await tx.ordenTrabajo.update({ where: { id: ordenId }, data: { estado: 'PENDIENTE_CIERRE', fechaCierre: null } });
      await recordTraceAudit({ entityType: 'OrdenTrabajo', entityId: ordenId, action: 'reopen', actor, before: { estado: 'CERRADA' }, after: { estado: 'PENDIENTE_CIERRE', fotoId: reopenedPhoto.id }, comment: motivo }, tx);
    });
    return { ...order, estado: 'PENDIENTE_CIERRE' as const, fechaCierre: null, etiquetaEstado: 'Pendiente de cierre' };
  }

  async list(userId: string, ordenId: string) {
    await this.order(userId, ordenId);
    return withTenant(userId, (tx) => tx.fotoCierreOrden.findMany({ where: { ordenId, userId }, orderBy: { version: 'asc' } }));
  }
}
