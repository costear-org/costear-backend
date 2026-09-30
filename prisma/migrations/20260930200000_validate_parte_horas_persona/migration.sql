-- Issue #508. La FK se creó NOT VALID en #507 para permitir diagnosticar datos históricos.
-- Esta migración falla con un mensaje accionable si hay UUIDs sin persona y luego valida la FK.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "partes_horas" ph
    LEFT JOIN "personas" p ON p."id" = ph."personaId"
    WHERE p."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'No se puede validar partes_horas.personaId: existen partes con personaId sin persona. Cargue el padrón correspondiente antes de continuar.'
      USING ERRCODE = '23503';
  END IF;
END $$;

ALTER TABLE "partes_horas" VALIDATE CONSTRAINT "partes_horas_personaId_fkey";
