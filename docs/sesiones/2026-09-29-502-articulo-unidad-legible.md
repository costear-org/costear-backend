---
issue: 502
repo: CosteAR-backend
pr: 506
rama: feat/articulo-unidad-legible-502
agente: codex
modelo: gpt-5
tanda: C1
inicio: 2026-09-29T02:23-03:00
fin: 2026-09-29T02:38-03:00
minutos: 15
tokens: no-informado
clears: 0
intentos_hasta_verde: 3
rojos_deliberados: 1
rebotes_de_guarda: 0
---

# 2026-09-29 — El artículo informa su unidad legible

## Recursos

- Prompt vigente de CosteAR-os: `b3e7221`.
- La primera corrida deliberada del test negativo quedó roja porque el servicio devolvía
  `unidad: null`. Después del cambio pasó con el error explícito esperado.
- La verificación general tuvo un timeout ajeno en `admin-stats` mientras las colas se iniciaban
  sin `DATABASE_URL`; el test pasó al repetirlo con el entorno local cargado.
- La base compartida conservaba una migración fallida de una rama anterior que ya no existe en
  `dev`. Para no modificar ese estado se creó y usó la base desechable `costear_automation_502`.

## Qué se hizo

- El listado y el alta de artículos ahora devuelven `unidad: { id, nombre, simbolo }` y conservan
  `unidadId` por compatibilidad.
- El listado resuelve la relación en la consulta y responde 422 con
  `UNIDAD_ARTICULO_NO_RESUELTA` si el artículo no tiene una unidad resoluble.
- Se actualizaron los esquemas Zod, OpenAPI, tipos generados y las pruebas unitarias y de
  integración/RLS.

## Decisiones que tomé sobre la marcha

- **Qué decidí:** publicar `UnidadMedida.codigo` como `unidad.simbolo`.
  **Qué otra opción había:** agregar una columna `simbolo` duplicada al esquema Prisma.
  **Por qué elegí esta:** el modelo ya define `codigo` como identificador estable y contiene los
  valores mostrables (`u.`, `kg`, etc.); el issue no pidió una migración y duplicar el dato podía
  introducir divergencia. Aplica Constitución §3: la unidad viaja explícitamente con el valor.
- **Qué decidí:** tratar una relación de unidad ausente como 422 tipado.
  **Qué otra opción había:** devolver `null` o dejar que apareciera un 500.
  **Por qué elegí esta:** el criterio de aceptación exige una falla explícita y la API no debe
  inventar una unidad ni exponer errores internos. Aplica Constitución §2.

## Dónde el issue no alcanzaba

- No definía de dónde sale `simbolo`; el esquema persistido sólo tiene `codigo` y `nombre`.
- No fijaba el código HTTP ni el código estable del error cuando falta la relación; se eligieron
  422 y `UNIDAD_ARTICULO_NO_RESUELTA`.

## Qué quedó afuera

- Catálogo o ABM de unidades.
- Conversión entre unidades, cubierta por #448.

## Con qué se verifica

```text
npx vitest run tests/application/inventario-service.test.ts
  rojo deliberado: 1 fallo; después 9/9 verdes
npm run lint
  verde
npm run typecheck
  verde
npm run test
  2072 verdes, 4 omitidos; un timeout ajeno pasó al repetir tests/http/admin-stats.test.ts (2/2)
npm run test:http
  222/222 verdes
npm run test:integration
  99/99 verdes sobre costear_automation_502
npm run check:openapi
  verde
npm run typecheck:openapi-consumer
  verde
npm run check:tests-base
  verde
CI de PR #506: build/test, integración, e2e y guardas
  verde
```
