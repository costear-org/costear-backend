---
issue: 488
repo: CosteAR-backend
pr: 497
rama: feat/catalogo-alcance-cargador
agente: codex
modelo: gpt-5
tanda: B3
inicio: 2026-09-27T00:07-03:00
fin: 2026-09-27T00:39-03:00
minutos: 32
tokens: no-informado
clears: 0
intentos_hasta_verde: 8
rojos_deliberados: 1
rebotes_de_guarda: 0
---

# 2026-09-27 — El cargador recibe sólo opciones de su alcance

Prompt vigente de CosteAR-os: `b3e7221`.

## Qué se hizo

- Se agregó el catálogo administrativo de unidades productivas y depósitos asignables, con las
  etiquetas visibles del `lexicon` del paquete.
- Se agregó el catálogo operativo por conexión. Expande acciones declaradas por el paquete sólo
  sobre entidades autorizadas y devuelve un estado explícito cuando la membresía no tiene alcance.
- Se declararon las acciones de carga y su entidad destino en `PaqueteRubro.access`, sin cambiar el
  schema, y se actualizó el seed global.
- Se publicaron ambos endpoints en OpenAPI y se documentó la decisión en ADR 0037.

## Decisiones que tomé sobre la marcha

- **Qué decidí:** ubicar las acciones en `PaqueteRubro.access.actions` y declarar `moduloId`,
  superficie, destino, tipo de entidad y permiso opcional.
  **Qué otra opción había:** inferir esos datos desde URLs/superficies o mantener un mapa central.
  **Por qué elegí esta:** el paquete debe decidir el contenido por rubro (Constitución §4) y el
  frontend no debe inventar lo que el contrato no declara (Constitución §9).
- **Qué decidí:** usar una ruta operativa por `connectionId`.
  **Qué otra opción había:** tomar silenciosamente la primera membresía como hace el `GET /me`
  legado.
  **Por qué elegí esta:** el chat ya selecciona una conexión y una misma persona puede pertenecer
  a varias empresas; la conexión vuelve explícito el tenant consultado.
- **Qué decidí:** mantener compatibilidad con paquetes persistidos antes de #488 mediante la
  declaración canónica del código cuando `access.actions` todavía no está sembrado.
  **Qué otra opción había:** devolver un catálogo vacío hasta volver a ejecutar el seed.
  **Por qué elegí esta:** evita una ventana donde una empresa con alcance válido pierde sus
  opciones después del deploy, sin inventar acciones fuera del paquete.

## Dónde el issue no alcanzaba

- No nombraba las rutas. Se eligieron nombres alineados con el portal existente y con el selector
  actual por conexión.
- No definía la forma exacta de una acción. Se publicó una forma autosuficiente para el frontend:
  clave, nombre, descripción, superficie, destino y entidad tipada.
- La base compartida tenía una migración fallida ajena (`20260925222000...`). Se usó la base
  desechable `costear_488`, sin modificar ni resolver la historia compartida.
- La base aislada necesitó los grants del rol de aplicación y variables de prueba no vacías. Los
  primeros intentos de integración/DB fallaron por ese setup; no se cambió código para ocultarlo.
- La primera corrida completa tuvo un timeout aislado en `admin-stats`; la prueba dirigida pasó y
  la segunda corrida completa quedó verde.

## Qué quedó afuera

- La pantalla y el selector del chat, que pertenecen a `CosteAR-frontend#190`.
- El modelo de alcance y sus migraciones, ya resueltos por #418.
- No se agregó una acción operativa para órdenes de trabajo porque #488 limita este contrato a
  `UnidadProductiva` y `Deposito`.

## Con qué se verifica

```bash
npm run verificar
# verde: 2056 unitarios, 214 HTTP, OpenAPI y guardas

DATABASE_URL=<rol-app-en-costear_488> MIGRATION_DATABASE_URL=<dueño-en-costear_488> npm run test:integration
# verde: 96/96, rol sin BYPASSRLS

DATABASE_URL=<dueño-en-costear_488> RLS_PROBE_DATABASE_URL=<sonda-en-costear_488> RLS_REQUIRE_PROBE=1 npm run test:db
# verde: 67/67
```
