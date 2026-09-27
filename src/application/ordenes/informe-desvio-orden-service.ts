import type { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma, withTenant } from '../../infrastructure/database/prisma.js';
import { NotFoundError } from '../../domain/errors/domain-error.js';

const ELEMENTOS = ['MP', 'MOD', 'CIF', 'ENTREGA'] as const;
type ElementoInforme = typeof ELEMENTOS[number];
type Sentido = 'FAVORABLE' | 'DESFAVORABLE' | 'NEUTRA';

const number = (value: unknown) => new Decimal(String(value ?? 0)).toDecimalPlaces(2).toNumber();
const sentido = (value: number): Sentido => value > 0 ? 'DESFAVORABLE' : value < 0 ? 'FAVORABLE' : 'NEUTRA';
const add = (totals: Record<ElementoInforme, Decimal>, key: ElementoInforme, value: unknown) => {
  totals[key] = totals[key].plus(String(value ?? 0));
};
const emptyTotals = (): Record<ElementoInforme, Decimal> => ({
  MP: new Decimal(0), MOD: new Decimal(0), CIF: new Decimal(0), ENTREGA: new Decimal(0),
});

export class InformeDesvioOrdenService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async get(userId: string, ordenId: string) {
    const orden = await withTenant(userId, (tx) => tx.ordenTrabajo.findFirst({
      where: { id: ordenId, userId },
      include: {
        presupuestos: { include: { renglones: true } },
        movimientosInventario: true,
        movimientosDestino: true,
        partesHoras: { include: { etapa: { select: { esEntrega: true } } } },
        costosDirectos: { include: { etapa: { select: { esEntrega: true } } } },
        aplicacionesIndirectos: { include: { corrida: { include: { pool: { select: { tipo: true } } } } } },
      },
    }));
    if (!orden) throw new NotFoundError('Orden de trabajo no encontrada');

    const budget = emptyTotals();
    const approved = orden.presupuestos.filter((row) => row.estado === 'APROBADO' && (row.tipo === 'BASE' || row.tipo === 'ADICIONAL'));
    for (const version of approved) {
      for (const row of version.renglones) {
        const key: ElementoInforme = row.elemento === 'CIP' ? 'CIF' : row.elemento === 'TERCEROS' ? 'ENTREGA' : row.elemento;
        add(budget, key, new Decimal(row.cantidad.toString()).times(row.precio.toString()));
      }
    }

    const actual = emptyTotals();
    for (const row of orden.movimientosInventario) {
      const importe = new Decimal(row.cantidad.toString()).times(row.costoUnitario.toString());
      if (row.tipo === 'SALIDA') actual.MP = actual.MP.plus(importe);
      if (row.tipo === 'DEVOLUCION' || row.tipo === 'TRANSFERENCIA') actual.MP = actual.MP.minus(importe);
    }
    for (const row of orden.movimientosDestino) {
      if (row.tipo === 'TRANSFERENCIA') add(actual, 'MP', new Decimal(row.cantidad.toString()).times(row.costoUnitario.toString()));
    }
    for (const row of orden.partesHoras) {
      if (row.estado !== 'APROBADO' || row.importeMod == null) continue;
      add(actual, row.etapa.esEntrega ? 'ENTREGA' : 'MOD', row.importeMod);
    }
    for (const row of orden.costosDirectos) {
      if (row.estadoValidacion !== 'VALIDADO') continue;
      add(actual, row.etapa.esEntrega ? 'ENTREGA' : 'MP', row.importe);
    }
    for (const row of orden.aplicacionesIndirectos) {
      if (row.corrida.pool.tipo === 'FABRIL') add(actual, 'CIF', row.importe);
    }

    const technicallyFinished = ['TERMINADA_TECNICA', 'PENDIENTE_CIERRE', 'CERRADA'].includes(orden.estado);
    const elementos = ELEMENTOS.map((elemento) => {
      const presupuestado = number(budget[elemento]);
      const real = number(actual[elemento]);
      const desvio = number(actual[elemento].minus(budget[elemento]));
      const comprometido = technicallyFinished ? 0 : number(Decimal.max(budget[elemento].minus(actual[elemento]), 0));
      return { elemento, presupuestado, real, desvio, sentido: sentido(desvio), comprometido, proyeccionAlTerminar: number(new Decimal(real).plus(comprometido)) };
    });
    const costoPresupuestado = number(approved.reduce((sum, row) => sum.plus(row.costoPrevisto.toString()), new Decimal(0)));
    const precioContractual = number(approved.reduce((sum, row) => sum.plus(row.precio.toString()), new Decimal(0)));
    const costoReal = number(ELEMENTOS.reduce((sum, key) => sum.plus(actual[key]), new Decimal(0)));
    const desvioTotal = number(new Decimal(costoReal).minus(costoPresupuestado));
    const causa: Record<ElementoInforme, 'PRECIO' | 'CANTIDAD' | 'EFICIENCIA' | 'ALCANCE' | 'ASIGNACION'> = {
      MP: 'PRECIO', MOD: 'EFICIENCIA', CIF: 'ASIGNACION', ENTREGA: 'ALCANCE',
    };
    const puente = elementos.map((item) => ({
      causa: causa[item.elemento], elemento: item.elemento, importe: item.desvio, sentido: item.sentido,
    }));

    return {
      ordenId,
      costoPresupuestado,
      costoReal,
      precioContractual,
      margenEsperado: number(new Decimal(precioContractual).minus(costoPresupuestado)),
      margenReal: number(new Decimal(precioContractual).minus(costoReal)),
      desvioTotal,
      sentido: sentido(desvioTotal),
      elementos,
      puente,
      proyeccionAlTerminar: {
        incurrido: costoReal,
        comprometido: number(elementos.reduce((sum, item) => sum.plus(item.comprometido), new Decimal(0))),
        total: number(elementos.reduce((sum, item) => sum.plus(item.proyeccionAlTerminar), new Decimal(0))),
        presupuesto: costoPresupuestado,
      },
    };
  }
}
