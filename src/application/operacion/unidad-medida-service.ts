import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma, withTenant } from '../../infrastructure/database/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors/domain-error.js';
import { recordTraceAudit, type TraceActor } from '../audit/trace-audit.js';
import type { UnidadMedidaCreateInput, UnidadMedidaUpdateInput } from '../../shared/schemas/unidad-medida.schema.js';

type Tx = Prisma.TransactionClient;

export class UnidadMedidaService {
  constructor(private readonly db: PrismaClient = prisma) {}
  private run<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    if (this.db === prisma) return withTenant(userId, fn);
    return this.db.$transaction(fn as never) as Promise<T>;
  }
  private present(unit: { id: string; codigo: string; nombre: string; factor: Prisma.Decimal; base: { id: string; codigo: string; nombre: string } | null }) {
    return { ...unit, factor: Number(unit.factor) };
  }
  private async company(tx: Tx, userId: string, companyId: string) {
    if (!await tx.company.findFirst({ where: { id: companyId, userId } })) throw new NotFoundError('Negocio no encontrado');
  }
  private async base(tx: Tx, companyId: string, baseId?: string | null) {
    if (!baseId) return null;
    const base = await tx.unidadMedida.findFirst({ where: { id: baseId, companyId, deletedAt: null } });
    if (!base || base.baseId) throw new ValidationError('La unidad base debe existir en el mismo negocio y no puede ser derivada', { field: 'baseId' });
    return base;
  }
  private async availableCode(tx: Tx, companyId: string, codigo: string, exceptId?: string) {
    const duplicate = await tx.unidadMedida.findFirst({ where: { companyId, codigo, ...(exceptId ? { id: { not: exceptId } } : {}) } });
    if (duplicate) throw new ConflictError('Ya existe una unidad con ese código', { field: 'codigo' });
  }
  private async find(tx: Tx, userId: string, id: string) {
    const unit = await tx.unidadMedida.findFirst({ where: { id, userId, deletedAt: null }, include: { base: { select: { id: true, codigo: true, nombre: true } } } });
    if (!unit) throw new NotFoundError('Unidad de medida no encontrada');
    return unit;
  }
  private async assertUnused(tx: Tx, id: string) {
    const [renglones, articulos, depositos, parametros, derivadas] = await Promise.all([
      tx.renglonPresupuesto.count({ where: { unidadId: id } }), tx.articulo.count({ where: { unidadId: id } }),
      tx.deposito.count({ where: { unidadId: id, deletedAt: null } }), tx.parametroCosteo.count({ where: { unidadId: id } }),
      tx.unidadMedida.count({ where: { baseId: id, deletedAt: null } }),
    ]);
    if (renglones + articulos + depositos + parametros + derivadas > 0) throw new ConflictError('La unidad está en uso y no se puede cambiar ni borrar');
  }
  async create(userId: string, companyId: string, input: UnidadMedidaCreateInput, actor: TraceActor) {
    return this.run(userId, async (tx) => {
      const codigo = input.codigo.trim().toLocaleLowerCase('es');
      await this.company(tx, userId, companyId); await this.availableCode(tx, companyId, codigo); await this.base(tx, companyId, input.baseId);
      const created = await tx.unidadMedida.create({ data: { companyId, userId, codigo, nombre: input.nombre, baseId: input.baseId ?? null, factor: input.baseId ? input.factor! : 1 }, include: { base: { select: { id: true, codigo: true, nombre: true } } } });
      await recordTraceAudit({ entityType: 'UnidadMedida', entityId: created.id, action: 'create', actor, after: created }, tx);
      return this.present(created);
    });
  }
  async list(userId: string, companyId: string) {
    return this.run(userId, async (tx) => { await this.company(tx, userId, companyId); return (await tx.unidadMedida.findMany({ where: { companyId, deletedAt: null }, orderBy: { codigo: 'asc' }, include: { base: { select: { id: true, codigo: true, nombre: true } } } })).map((unit) => this.present(unit)); });
  }
  async update(userId: string, id: string, input: UnidadMedidaUpdateInput, actor: TraceActor) {
    return this.run(userId, async (tx) => {
      const before = await this.find(tx, userId, id);
      const changesIdentity = input.codigo !== undefined || input.baseId !== undefined || input.factor !== undefined;
      if (changesIdentity) await this.assertUnused(tx, id);
      const codigo = input.codigo?.trim().toLocaleLowerCase('es');
      if (codigo) await this.availableCode(tx, before.companyId, codigo, id);
      if (input.baseId !== undefined) await this.base(tx, before.companyId, input.baseId);
      const baseId = input.baseId === undefined ? before.baseId : input.baseId;
      const factor = input.factor === undefined ? Number(before.factor) : input.factor;
      if (baseId && factor <= 0) throw new ValidationError('El factor debe ser mayor que cero', { field: 'factor' });
      if (!baseId && factor !== 1) throw new ValidationError('El factor de una unidad base debe ser 1', { field: 'factor' });
      const updated = await tx.unidadMedida.update({ where: { id }, data: { ...input, ...(codigo ? { codigo } : {}), baseId, factor }, include: { base: { select: { id: true, codigo: true, nombre: true } } } });
      await recordTraceAudit({ entityType: 'UnidadMedida', entityId: id, action: 'update', actor, before, after: updated }, tx);
      return this.present(updated);
    });
  }
  async remove(userId: string, id: string, actor: TraceActor) {
    return this.run(userId, async (tx) => {
      const before = await this.find(tx, userId, id); await this.assertUnused(tx, id);
      const updated = await tx.unidadMedida.update({ where: { id }, data: { deletedAt: new Date() } });
      await recordTraceAudit({ entityType: 'UnidadMedida', entityId: id, action: 'delete', actor, before, after: updated }, tx);
    });
  }
}
