-- Issue #507. Migración aditiva: padrón de personal y tarifas por categoría.
ALTER TABLE "tarifas_mano_obra" ADD COLUMN "categoriaId" UUID;

CREATE TABLE "categorias_personal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "nombre" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categorias_personal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "personas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "categoriaId" UUID,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "categorias_personal_userId_idx" ON "categorias_personal"("userId");
CREATE UNIQUE INDEX "categorias_personal_companyId_nombre_key" ON "categorias_personal"("companyId", "nombre");
CREATE INDEX "personas_userId_idx" ON "personas"("userId");
CREATE INDEX "personas_companyId_activa_nombre_idx" ON "personas"("companyId", "activa", "nombre");
-- NULLS NOT DISTINCT garantiza una sola tarifa general por fecha, además de una por categoría.
CREATE UNIQUE INDEX "tarifas_mano_obra_companyId_categoriaId_vigenteDesde_key"
  ON "tarifas_mano_obra" ("companyId", "categoriaId", "vigenteDesde") NULLS NOT DISTINCT;

ALTER TABLE "tarifas_mano_obra" ADD CONSTRAINT "tarifas_mano_obra_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "categorias_personal"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "categorias_personal" ADD CONSTRAINT "categorias_personal_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "personas" ADD CONSTRAINT "personas_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "personas" ADD CONSTRAINT "personas_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "categorias_personal"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
-- Los partes históricos de #475 aceptaban UUIDs sin padrón. NOT VALID conserva esos hechos;
-- desde esta migración, PostgreSQL sí exige una persona existente para cada parte nuevo.
ALTER TABLE "partes_horas" ADD CONSTRAINT "partes_horas_personaId_fkey"
  FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
