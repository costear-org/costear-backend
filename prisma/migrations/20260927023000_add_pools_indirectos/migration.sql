CREATE TYPE "TipoPoolIndirecto" AS ENUM ('FABRIL', 'ADMINISTRACION', 'COMERCIALIZACION');
CREATE TYPE "BasePoolIndirecto" AS ENUM ('HORAS_HOMBRE', 'HORAS_MAQUINA', 'SUPERFICIE', 'DIAS_OCUPACION', 'MOVIMIENTOS', 'OTRA');
CREATE TYPE "NaturalezaCostoRealPool" AS ENUM ('FIJO', 'VARIABLE');

CREATE TABLE "pools_indirectos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "companyId" UUID NOT NULL, "userId" UUID NOT NULL,
  "nombre" VARCHAR(160) NOT NULL, "tipo" "TipoPoolIndirecto" NOT NULL, "base" "BasePoolIndirecto" NOT NULL,
  "presupuestoFijo" DECIMAL(18,4) NOT NULL, "presupuestoVariable" DECIMAL(18,4) NOT NULL,
  "capacidadNormal" DECIMAL(18,4) NOT NULL, "periodo" VARCHAR(7) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pools_indirectos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pools_indirectos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "pools_indirectos_userId_idx" ON "pools_indirectos"("userId");
CREATE INDEX "pools_indirectos_companyId_periodo_idx" ON "pools_indirectos"("companyId", "periodo");

CREATE TABLE "costos_reales_pool" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "poolId" UUID NOT NULL, "userId" UUID NOT NULL,
  "periodo" VARCHAR(7) NOT NULL, "concepto" VARCHAR(200) NOT NULL, "naturaleza" "NaturalezaCostoRealPool" NOT NULL,
  "importe" DECIMAL(18,4) NOT NULL, "origen" VARCHAR(500) NOT NULL, "reemplazaAId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "costos_reales_pool_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "costos_reales_pool_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools_indirectos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "costos_reales_pool_reemplazaAId_fkey" FOREIGN KEY ("reemplazaAId") REFERENCES "costos_reales_pool"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "costos_reales_pool_userId_idx" ON "costos_reales_pool"("userId");
CREATE UNIQUE INDEX "costos_reales_pool_reemplazaAId_key" ON "costos_reales_pool"("reemplazaAId");
CREATE INDEX "costos_reales_pool_poolId_periodo_concepto_createdAt_idx" ON "costos_reales_pool"("poolId", "periodo", "concepto", "createdAt");

CREATE TABLE "corridas_asignacion_pool" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "poolId" UUID NOT NULL, "userId" UUID NOT NULL, "periodo" VARCHAR(7) NOT NULL,
  "tasaFija" DECIMAL(18,8) NOT NULL, "tasaVariable" DECIMAL(18,8) NOT NULL, "tasaTotal" DECIMAL(18,8) NOT NULL,
  "cifReal" DECIMAL(18,4) NOT NULL, "cifRealFijo" DECIMAL(18,4) NOT NULL, "cifRealVariable" DECIMAL(18,4) NOT NULL,
  "variacionPresupuesto" DECIMAL(18,4) NOT NULL, "variacionVolumen" DECIMAL(18,4) NOT NULL,
  "sentidoPresupuesto" VARCHAR(20) NOT NULL, "sentidoVolumen" VARCHAR(20) NOT NULL,
  "formula" TEXT NOT NULL, "versionMotor" VARCHAR(40) NOT NULL, "costosRealesUsados" UUID[] NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "corridas_asignacion_pool_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corridas_asignacion_pool_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools_indirectos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "corridas_asignacion_pool_userId_idx" ON "corridas_asignacion_pool"("userId");
CREATE INDEX "corridas_asignacion_pool_poolId_periodo_createdAt_idx" ON "corridas_asignacion_pool"("poolId", "periodo", "createdAt");

CREATE TABLE "aplicaciones_corrida_pool" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "corridaId" UUID NOT NULL, "ordenId" UUID NOT NULL, "userId" UUID NOT NULL,
  "cantidadBase" DECIMAL(18,4) NOT NULL, "importe" DECIMAL(18,4) NOT NULL,
  CONSTRAINT "aplicaciones_corrida_pool_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aplicaciones_corrida_pool_corridaId_fkey" FOREIGN KEY ("corridaId") REFERENCES "corridas_asignacion_pool"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "aplicaciones_corrida_pool_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "aplicaciones_corrida_pool_userId_idx" ON "aplicaciones_corrida_pool"("userId");
CREATE INDEX "aplicaciones_corrida_pool_corridaId_idx" ON "aplicaciones_corrida_pool"("corridaId");
CREATE INDEX "aplicaciones_corrida_pool_ordenId_idx" ON "aplicaciones_corrida_pool"("ordenId");

CREATE OR REPLACE FUNCTION reject_costo_real_pool_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'costos_reales_pool es append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER costos_reales_pool_append_only BEFORE UPDATE OR DELETE ON "costos_reales_pool"
FOR EACH ROW EXECUTE FUNCTION reject_costo_real_pool_mutation();
