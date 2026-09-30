---
issue: 501
repo: CosteAR-backend
pr: 519
rama: feat/salidas-inventario-elegibles
agente: codex
modelo: gpt-5
tanda: C1
inicio: 2026-09-30T14:10-03:00
fin: 2026-09-30T14:32-03:00
minutos: 22
tokens: no-informado
clears: 0
intentos_hasta_verde: 5
rojos_deliberados: 1
rebotes_de_guarda: 0
---

# 2026-09-30 — Salidas de inventario elegibles para devolución y transferencia

## Qué se hizo

- Prompt vigente de CosteAR-os leído en la versión `dcdfba4`.
- Se publicó `GET /companies/{companyId}/movimientos-inventario`, filtrable por artículo y orden.
- El listado devuelve la cantidad original y la disponible después de descontar devoluciones y transferencias.
- Las salidas agotadas y las de otra empresa no aparecen como elegibles.
- Se declaró explícitamente `costoUnitario` en la respuesta del POST y se regeneraron los artefactos OpenAPI.

## Decisiones que tomé sobre la marcha

- **Qué decidí:** ordenar las salidas por fecha y creación descendentes.
  **Qué otra opción había:** conservar orden ascendente o no declarar orden.
  **Por qué elegí esta:** la operación es una selección de movimientos recientes y el issue no imponía otro criterio; el orden queda estable sin alterar datos.
- **Qué decidí:** serializar `costoUnitario` a número sólo en el borde HTTP.
  **Qué otra opción había:** cambiar el retorno interno de `InventarioService.registrar`.
  **Por qué elegí esta:** preserva la semántica idempotente existente del servicio y aplica Constitución §3 al declarar el valor completo en el contrato.
- **Qué decidí:** excluir defensivamente salidas sin orden aunque el alta actual ya exige una.
  **Qué otra opción había:** publicar un `ordenId` nullable.
  **Por qué elegí esta:** una devolución o transferencia necesita una orden de origen y el contrato solicitado incluye ese filtro.

## Dónde el issue no alcanzaba

- No definía el orden del listado; se eligió fecha y creación descendentes.
- No especificaba si los filtros eran obligatorios; se hicieron opcionales para permitir listar todas las salidas elegibles de la empresa.
- La base desechable nueva necesitó los mismos grants del rol `costear_app` que configura CI para poder verificar RLS localmente.
- La primera corrida completa sin `DATABASE_URL` tuvo el timeout ya observado en `tests/http/admin-stats.test.ts`; con la base desechable configurada, la corrida completa pasó.

## Qué quedó afuera

- La pantalla frontend, explícitamente fuera de alcance en el issue.
- No se modificaron el motor de cálculo ni el schema Prisma.

## Con qué se verifica

```bash
npm run lint                                      # verde
npm run typecheck                                 # verde
npm run test                                      # 2083 passed, 4 skipped
npm run test:http                                 # 222 passed
npm run test:integration                          # 104 passed
npm run check:openapi                             # verde, 96 operaciones tipadas
npm run typecheck:openapi-consumer                # verde
npm run check:tests-base                          # verde
```
