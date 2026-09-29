---
issue: 510
repo: CosteAR-backend
pr: 518
rama: feat/unidades-medida-api
agente: codex
modelo: gpt-5
tanda: C1
inicio: 2026-09-29T15:34-03:00
fin: 2026-09-29T15:52-03:00
minutos: 18
tokens: no-informado
clears: 0
intentos_hasta_verde: 2
rojos_deliberados: 1
rebotes_de_guarda: 0
---

# 2026-09-29 — Las empresas pueden administrar sus unidades de medida

## Qué se hizo

- Prompt vigente de CosteAR-os leído en la versión `dcdfba4`.
- Se agregaron alta, listado, edición y borrado lógico de unidades de medida por empresa.
- Se validan códigos únicos y normalizados, factores positivos, bases del mismo tenant y una sola derivación por familia.
- Los campos estructurales quedan bloqueados cuando la unidad ya se usa; el nombre sigue siendo corregible.
- Cada mutación escribe `TraceAuditLog` dentro de la misma transacción.
- Se publicaron las cuatro rutas y `POST /companies/{companyId}/depositos` en OpenAPI.

## Decisiones que tomé sobre la marcha

- **Qué decidí:** permitir que `PATCH` cambie `codigo`, `baseId` y `factor` únicamente antes del primer uso, además de permitir siempre `nombre`.
  **Qué otra opción había:** aceptar literalmente “sólo nombre” y rechazar cualquier otro campo con 400.
  **Por qué elegí esta:** el propio criterio de aceptación exige 409 al cambiar el factor de una unidad usada. La restricción preserva cantidades históricas y aplica Constitución §3.
- **Qué decidí:** una unidad base con derivadas también cuenta como “en uso” para la baja.
  **Qué otra opción había:** permitir borrar la base si no aparecía en renglones, artículos, depósitos o parámetros.
  **Por qué elegí esta:** evitar una familia activa apuntando a una unidad borrada lógicamente es la opción aditiva y conservadora.
- **Qué decidí:** los operadores con cualquier membresía activa pueden listar unidades, pero sólo `EMPRESA_ADMIN` y `EMPRESARIO` pueden mutarlas.
  **Qué otra opción había:** exigir un permiso funcional de inventario también para leer.
  **Por qué elegí esta:** el issue autoriza explícitamente la lectura a cualquier operador con acceso a la empresa.

## Dónde el issue no alcanzaba

- “PATCH: sólo nombre” contradice el caso de aceptación que espera 409 al cambiar `factor` si la unidad está usada. Se priorizó el criterio verificable y se documentó la decisión.
- No definía el estado HTTP de la baja; se mantuvo `204`.
- La base local compartida `costear` tenía una migración fallida ajena. Se creó `costear_issue510` como base desechable y no se alteró el historial existente.
- La primera corrida completa de unitarios tuvo un timeout en `tests/http/admin-stats.test.ts` al no tener `DATABASE_URL`; con la base desechable configurada, la corrida completa pasó.

## Qué quedó afuera

- La pantalla de unidades, la conversión automática entre familias y el catálogo por rubro, tal como marca el issue.
- No se modificó el motor de cálculo ni el schema Prisma.

## Con qué se verifica

```bash
npm run lint                                      # verde
npm run typecheck                                 # verde
npm run test                                      # 2080 passed, 4 skipped
npm run test:http                                 # 222 passed
npm run test:integration                          # 104 passed
npm run check:openapi                             # verde, 95 operaciones tipadas
npm run typecheck:openapi-consumer                # verde
npm run check:tests-base                          # verde
```
