import type { EstadoOrdenTrabajo, PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma, withTenant } from '../../infrastructure/database/prisma.js';
import { InformeDesvioOrdenService } from './informe-desvio-orden-service.js';
import { OrdenTrabajoService, ETIQUETAS_ESTADO } from './orden-trabajo-service.js';

const ESTADOS_INACTIVOS: EstadoOrdenTrabajo[] = ['CERRADA', 'CANCELADA'];
const ESTADOS_TERMINADOS: EstadoOrdenTrabajo[] = ['TERMINADA_TECNICA', 'PENDIENTE_CIERRE', 'CERRADA'];
const porcentaje = (value: Decimal) => value.toDecimalPlaces(2).toNumber();

export class CarteraOrdenesService {
  private readonly ordenes: OrdenTrabajoService;
  private readonly informes: InformeDesvioOrdenService;

  constructor(private readonly db: PrismaClient = prisma) {
    this.ordenes = new OrdenTrabajoService(db);
    this.informes = new InformeDesvioOrdenService(db);
  }

  async list(userId: string, companyId: string, ordenIds?: string[]) {
    const orders = (await this.ordenes.list(userId, companyId, ordenIds))
      .filter((order) => !ESTADOS_INACTIVOS.includes(order.estado));
    if (orders.length === 0) return [];

    const alertasActivas = await withTenant(userId, (tx) => tx.alert.count({
      where: { userId, companyId, isRead: false },
    }));
    const rows = await Promise.all(orders.map(async (order) => {
      const informe = await this.informes.get(userId, order.id);
      const precio = new Decimal(informe.precioContractual);
      const margenPresupuestadoPct = precio.isZero()
        ? 0
        : porcentaje(new Decimal(informe.margenEsperado).div(precio).times(100));
      const margenProyectadoPct = precio.isZero()
        ? 0
        : porcentaje(precio.minus(informe.proyeccionAlTerminar.total).div(precio).times(100));
      const desvioPp = porcentaje(new Decimal(margenPresupuestadoPct).minus(margenProyectadoPct));
      return {
        codigo: order.codigo,
        descripcion: order.descripcion,
        cliente: order.cliente,
        estado: order.estado,
        etiquetaEstado: ETIQUETAS_ESTADO[order.estado],
        avancePct: ESTADOS_TERMINADOS.includes(order.estado) ? 100 : 0,
        margenPresupuestadoPct,
        margenProyectadoPct,
        desvioPp,
        alertasActivas,
      };
    }));
    return rows.sort((a, b) => b.desvioPp - a.desvioPp);
  }
}
