CREATE TABLE "fotos_cierre_orden" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "ordenId" UUID NOT NULL, "userId" UUID NOT NULL,
  "version" INTEGER NOT NULL, "congelado" JSONB NOT NULL, "versionMotor" VARCHAR(40) NOT NULL,
  "cerradoPor" UUID NOT NULL, "motivoReapertura" VARCHAR(500), "anteriorId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fotos_cierre_orden_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fotos_cierre_orden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "fotos_cierre_orden_anteriorId_fkey" FOREIGN KEY ("anteriorId") REFERENCES "fotos_cierre_orden"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "fotos_cierre_orden_ordenId_version_key" ON "fotos_cierre_orden"("ordenId", "version");
CREATE UNIQUE INDEX "fotos_cierre_orden_anteriorId_key" ON "fotos_cierre_orden"("anteriorId");
CREATE INDEX "fotos_cierre_orden_userId_idx" ON "fotos_cierre_orden"("userId");
CREATE INDEX "fotos_cierre_orden_ordenId_createdAt_idx" ON "fotos_cierre_orden"("ordenId", "createdAt");

CREATE OR REPLACE FUNCTION reject_foto_cierre_orden_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'fotos_cierre_orden es append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER fotos_cierre_orden_append_only BEFORE UPDATE OR DELETE ON "fotos_cierre_orden"
FOR EACH ROW EXECUTE FUNCTION reject_foto_cierre_orden_mutation();
