import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma, withTenant } from '../../infrastructure/database/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors/domain-error.js';
import { calcDepartmentMod } from '../../domain/calculations/direct-labor.js';
import { Percentage } from '../../domain/value-objects/percentage.js';
import { recordTraceAudit, type TraceActor } from '../audit/trace-audit.js';
import type { CategoriaPersonalCreateInput, PersonaCreateInput, PersonaUpdateInput, TarifaManoObraCreateInput } from '../../shared/schemas/personal.schema.js';

type Tx = Prisma.TransactionClient;
type Category = { id: string; nombre: string } | null;
const utcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export class PersonalService {
  constructor(private readonly db: PrismaClient = prisma) {}

  private run<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    if (this.db === prisma) return withTenant(userId, fn);
    return this.db.$transaction(fn as never) as Promise<T>;
  }

  private async company(tx: Tx, userId: string, companyId: string) {
    if (!await tx.company.findFirst({ where: { id: companyId, userId } })) throw new NotFoundError('Negocio no encontrado');
  }

  private async category(tx: Tx, companyId: string, categoriaId?: string | null): Promise<Category> {
    if (!categoriaId) return null;
    const category = await tx.categoriaPersonal.findFirst({ where: { id: categoriaId, companyId }, select: { id: true, nombre: true } });
    if (!category) throw new ValidationError('La categoría debe pertenecer al mismo negocio', { field: 'categoriaId' });
    return category;
  }

  async listCategories(userId: string, companyId: string) {
    return this.run(userId, async (tx) => {
      await this.company(tx, userId, companyId);
      return tx.categoriaPersonal.findMany({ where: { companyId }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });
    });
  }

  async createCategory(userId: string, companyId: string, input: CategoriaPersonalCreateInput, actor: TraceActor) {
    try { return await this.run(userId, async (tx) => {
      await this.company(tx, userId, companyId);
      if (await tx.categoriaPersonal.findFirst({ where: { companyId, nombre: input.nombre } })) throw new ConflictError('Ya existe una categoría con ese nombre', { field: 'nombre' });
      const created = await tx.categoriaPersonal.create({ data: { companyId, userId, nombre: input.nombre }, select: { id: true, nombre: true } });
      await recordTraceAudit({ entityType: 'CategoriaPersonal', entityId: created.id, action: 'create', actor, after: created }, tx);
      return created;
    }); } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictError('Ya existe una categoría con ese nombre', { field: 'nombre' });
      throw error;
    }
  }

  async listPeople(userId: string, companyId: string) {
    return this.run(userId, async (tx) => {
      await this.company(tx, userId, companyId);
      return tx.persona.findMany({ where: { companyId }, select: { id: true, nombre: true, categoria: { select: { id: true, nombre: true } }, activa: true }, orderBy: { nombre: 'asc' } });
    });
  }

  async createPerson(userId: string, companyId: string, input: PersonaCreateInput, actor: TraceActor) {
    return this.run(userId, async (tx) => {
      await this.company(tx, userId, companyId);
      await this.category(tx, companyId, input.categoriaId);
      const created = await tx.persona.create({ data: { companyId, userId, nombre: input.nombre, categoriaId: input.categoriaId ?? null, activa: input.activa ?? true }, select: { id: true, nombre: true, categoria: { select: { id: true, nombre: true } }, activa: true } });
      await recordTraceAudit({ entityType: 'Persona', entityId: created.id, action: 'create', actor, after: created }, tx);
      return created;
    });
  }

  async updatePerson(userId: string, id: string, input: PersonaUpdateInput, actor: TraceActor) {
    return this.run(userId, async (tx) => {
      const before = await tx.persona.findFirst({ where: { id, userId }, include: { categoria: { select: { id: true, nombre: true } } } });
      if (!before) throw new NotFoundError('Persona no encontrada');
      if (input.categoriaId !== undefined) await this.category(tx, before.companyId, input.categoriaId);
      const updated = await tx.persona.update({ where: { id }, data: input, select: { id: true, nombre: true, categoria: { select: { id: true, nombre: true } }, activa: true } });
      await recordTraceAudit({ entityType: 'Persona', entityId: id, action: 'update', actor, before, after: updated }, tx);
      return updated;
    });
  }

  private presentRate(rate: { id: string; nombre: string; categoria: Category; basicRemuneration: Prisma.Decimal; hoursWorked: Prisma.Decimal; productiveHours: Prisma.Decimal | null; standardHours: Prisma.Decimal | null; itcsPct: Prisma.Decimal; primaExtraPct: Prisma.Decimal; vigenteDesde: Date }) {
    const tarifaHora = calcDepartmentMod({
      name: rate.nombre,
      basicRemuneration: rate.basicRemuneration.toString(),
      hoursWorked: rate.hoursWorked.toString(),
      productiveHours: rate.productiveHours?.toString(),
      standardHours: rate.standardHours?.toString(),
    }, Percentage.fromPercent(rate.itcsPct.toString())).hourlyRate.toNumber();
    return {
      ...rate,
      basicRemuneration: Number(rate.basicRemuneration), hoursWorked: Number(rate.hoursWorked),
      productiveHours: rate.productiveHours === null ? null : Number(rate.productiveHours),
      standardHours: rate.standardHours === null ? null : Number(rate.standardHours),
      itcsPct: Number(rate.itcsPct), primaExtraPct: Number(rate.primaExtraPct), tarifaHora,
    };
  }

  async listRates(userId: string, companyId: string) {
    return this.run(userId, async (tx) => {
      await this.company(tx, userId, companyId);
      const rates = await tx.tarifaManoObra.findMany({ where: { companyId }, include: { categoria: { select: { id: true, nombre: true } } }, orderBy: [{ vigenteDesde: 'desc' }, { nombre: 'asc' }] });
      return rates.map((rate) => this.presentRate(rate));
    });
  }

  async createRate(userId: string, companyId: string, input: TarifaManoObraCreateInput, actor: TraceActor) {
    try { return await this.run(userId, async (tx) => {
      await this.company(tx, userId, companyId);
      await this.category(tx, companyId, input.categoriaId);
      const vigenteDesde = utcDate(input.vigenteDesde);
      const duplicate = await tx.tarifaManoObra.findFirst({ where: { companyId, categoriaId: input.categoriaId ?? null, vigenteDesde } });
      if (duplicate) throw new ConflictError('Ya existe una tarifa para esa categoría y fecha de vigencia', { field: 'vigenteDesde' });
      const created = await tx.tarifaManoObra.create({ data: { ...input, companyId, userId, categoriaId: input.categoriaId ?? null, vigenteDesde }, include: { categoria: { select: { id: true, nombre: true } } } });
      await recordTraceAudit({ entityType: 'TarifaManoObra', entityId: created.id, action: 'create', actor, after: created }, tx);
      return this.presentRate(created);
    }); } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictError('Ya existe una tarifa para esa categoría y fecha de vigencia', { field: 'vigenteDesde' });
      throw error;
    }
  }
}
