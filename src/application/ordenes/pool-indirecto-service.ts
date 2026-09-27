import type { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma, withTenant } from '../../infrastructure/database/prisma.js';
import { NotFoundError, UnprocessableEntityError, ValidationError } from '../../domain/errors/domain-error.js';
import { calcPredeterminedQuota, calcVarianceAnalysis } from '../../domain/calculations/indirect-costs.js';
import { Money } from '../../domain/value-objects/money.js';
import { recordTraceAudit, type TraceActor } from '../audit/trace-audit.js';
import type { CostoRealPoolCreateInput, CorridaPoolCreateInput, PoolIndirectoCreateInput } from '../../shared/schemas/pool-indirecto.schema.js';

const numeric = <T extends Record<string, unknown>>(row: T) => Object.fromEntries(Object.entries(row).map(([key, value]) =>
  [key, value instanceof Decimal ? value.toNumber() : value],
)) as T;
const sentido = (value: number) => value > 0 ? 'DESFAVORABLE' : value < 0 ? 'FAVORABLE' : 'NEUTRA';

export class PoolIndirectoService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async createPool(userId: string, companyId: string, input: PoolIndirectoCreateInput, actor: TraceActor) {
    const company = await withTenant(userId, (tx) => tx.company.findFirst({ where: { id: companyId, userId }, select: { id: true } }));
    if (!company) throw new NotFoundError('Empresa no encontrada');
    return withTenant(userId, async (tx) => {
      const created = await tx.poolIndirecto.create({ data: { ...input, companyId, userId } });
      await recordTraceAudit({ entityType: 'PoolIndirecto', entityId: created.id, action: 'create', actor, after: created }, tx);
      return numeric(created);
    });
  }

  async createActual(userId: string, poolId: string, input: CostoRealPoolCreateInput, actor: TraceActor) {
    const pool = await withTenant(userId, (tx) => tx.poolIndirecto.findFirst({ where: { id: poolId, userId }, select: { id: true } }));
    if (!pool) throw new NotFoundError('Pool indirecto no encontrado');
    if (input.reemplazaA) {
      const reemplazaA = input.reemplazaA;
      const prior = await withTenant(userId, (tx) => tx.costoRealPool.findFirst({ where: { id: reemplazaA, poolId, userId } }));
      if (!prior) throw new ValidationError('El costo real reemplazado no pertenece a este pool');
      const subsequent = await withTenant(userId, (tx) => tx.costoRealPool.findFirst({ where: { reemplazaAId: reemplazaA, poolId, userId } }));
      if (subsequent) throw new ValidationError('Ese costo real ya fue corregido; reemplazá el último registro de la cadena');
      if (prior.periodo !== input.periodo || prior.concepto !== input.concepto || prior.naturaleza !== input.naturaleza) {
        throw new ValidationError('Una corrección conserva período, concepto y naturaleza');
      }
    }
    return withTenant(userId, async (tx) => {
      const created = await tx.costoRealPool.create({ data: { poolId, userId, periodo: input.periodo, concepto: input.concepto, naturaleza: input.naturaleza, importe: input.importe, origen: input.origen, reemplazaAId: input.reemplazaA ?? null } });
      await recordTraceAudit({ entityType: 'CostoRealPool', entityId: created.id, action: 'create', actor, after: created }, tx);
      return numeric(created);
    });
  }

  async listActuals(userId: string, poolId: string, periodo?: string) {
    const pool = await withTenant(userId, (tx) => tx.poolIndirecto.findFirst({ where: { id: poolId, userId }, select: { id: true } }));
    if (!pool) throw new NotFoundError('Pool indirecto no encontrado');
    return (await withTenant(userId, (tx) => tx.costoRealPool.findMany({ where: { poolId, userId, ...(periodo ? { periodo } : {}) }, orderBy: { createdAt: 'asc' } }))).map(numeric);
  }

  async run(userId: string, poolId: string, input: CorridaPoolCreateInput, actor: TraceActor) {
    const pool = await withTenant(userId, (tx) => tx.poolIndirecto.findFirst({ where: { id: poolId, userId } }));
    if (!pool) throw new NotFoundError('Pool indirecto no encontrado');
    if (pool.periodo !== input.periodo) throw new ValidationError('El período de la corrida no coincide con el pool');
    if (new Decimal(pool.capacidadNormal).lte(0)) throw new UnprocessableEntityError('El pool no tiene base declarada', { field: 'capacidadNormal' });
    const orderIds = input.aplicaciones.map((x) => x.ordenId);
    if (new Set(orderIds).size !== orderIds.length) throw new ValidationError('Cada orden puede aparecer una sola vez en la corrida');
    const orders = await withTenant(userId, (tx) => tx.ordenTrabajo.findMany({ where: { id: { in: orderIds }, companyId: pool.companyId, userId }, select: { id: true } }));
    if (orders.length !== orderIds.length) throw new ValidationError('Todas las órdenes deben pertenecer a la empresa del pool');

    const actuals = await withTenant(userId, (tx) => tx.costoRealPool.findMany({ where: { poolId, userId, periodo: input.periodo }, orderBy: { createdAt: 'asc' } }));
    const replaced = new Set(actuals.map((x) => x.reemplazaAId).filter((x): x is string => Boolean(x)));
    const current = actuals.filter((x) => !replaced.has(x.id));
    if (current.length === 0) throw new UnprocessableEntityError(`Sin CIF real cargado para ${input.periodo}`, { field: 'periodo' });
    const fixed = Money.sum(current.filter((x) => x.naturaleza === 'FIJO').map((x) => Money.of(x.importe.toString())));
    const variable = Money.sum(current.filter((x) => x.naturaleza === 'VARIABLE').map((x) => Money.of(x.importe.toString())));
    const budget = { fixed: Money.of(pool.presupuestoFijo.toString()), variable: Money.of(pool.presupuestoVariable.toString()) };
    const quota = calcPredeterminedQuota(budget, pool.capacidadNormal.toString());
    const activity = input.aplicaciones.reduce((sum, x) => sum.plus(x.cantidadBase), new Decimal(0));
    const variance = calcVarianceAnalysis(quota, budget, pool.capacidadNormal.toString(), activity, fixed.add(variable), pool.nombre);
    const baseTotal = activity;
    const apps = input.aplicaciones.map((x) => ({
      ...x,
      importe: pool.tipo === 'FABRIL'
        ? quota.totalQuota.multiply(x.cantidadBase).add(variance.budgetVariance.multiply(new Decimal(x.cantidadBase).div(baseTotal))).toNumber()
        : 0,
    }));
    return withTenant(userId, async (tx) => {
      const created = await tx.corridaAsignacionPool.create({ data: {
        poolId, userId, periodo: input.periodo, tasaFija: quota.fixedQuota.toFixed(8), tasaVariable: quota.variableQuota.toFixed(8), tasaTotal: quota.totalQuota.toFixed(8),
        cifReal: fixed.add(variable).toFixed(4), cifRealFijo: fixed.toFixed(4), cifRealVariable: variable.toFixed(4),
        variacionPresupuesto: variance.budgetVariance.toFixed(4), variacionVolumen: variance.volumeVariance.toFixed(4),
        sentidoPresupuesto: sentido(variance.budgetVariance.toNumber()), sentidoVolumen: sentido(variance.volumeVariance.toNumber()),
        formula: 'CIF aplicado = cuota predeterminada × base real; variación presupuesto prorrateada por base; variación volumen a resultados',
        versionMotor: 'indirect-costs-v1', costosRealesUsados: current.map((x) => x.id),
        aplicaciones: { create: apps.map((x) => ({ ordenId: x.ordenId, userId, cantidadBase: x.cantidadBase, importe: x.importe })) },
      }, include: { aplicaciones: true } });
      await recordTraceAudit({ entityType: 'CorridaAsignacionPool', entityId: created.id, action: 'create', actor, after: created }, tx);
      return { ...numeric(created), aplicaciones: created.aplicaciones.map(numeric) };
    });
  }

  async listRuns(userId: string, poolId: string) {
    const pool = await withTenant(userId, (tx) => tx.poolIndirecto.findFirst({ where: { id: poolId, userId }, select: { id: true } }));
    if (!pool) throw new NotFoundError('Pool indirecto no encontrado');
    const rows = await withTenant(userId, (tx) => tx.corridaAsignacionPool.findMany({ where: { poolId, userId }, include: { aplicaciones: true }, orderBy: { createdAt: 'asc' } }));
    return rows.map((row) => ({ ...numeric(row), aplicaciones: row.aplicaciones.map(numeric) }));
  }
}
