ALTER TYPE "EstadoValidacionOrden" ADD VALUE 'RECHAZADO';

ALTER TABLE "costos_directos_orden"
  ADD COLUMN "motivoRechazo" VARCHAR(500);

ALTER TABLE "eventos_contingencia"
  ADD COLUMN "unidadId" UUID,
  ADD COLUMN "motivoRechazo" VARCHAR(500),
  ADD CONSTRAINT "eventos_contingencia_unidadId_fkey"
    FOREIGN KEY ("unidadId") REFERENCES "unidades_medida"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX "eventos_contingencia_unidadId_idx" ON "eventos_contingencia"("unidadId");
