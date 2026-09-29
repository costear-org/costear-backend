---
issue: 481
repo: CosteAR-backend
pr: 505
rama: feat/cartera-ordenes-481
agente: codex
modelo: gpt-5
tanda: C1
inicio: 2026-09-29T01:25-03:00
fin: 2026-09-29T01:35-03:00
minutos: 10
tokens: no-informado
clears: 0
intentos_hasta_verde: 3
rojos_deliberados: 1
rebotes_de_guarda: 0
---

# 2026-09-29 — Cartera de obras activas con margen proyectado

## Qué se hizo

- Se publicó `GET /companies/{companyId}/cartera-ordenes` para listar sólo órdenes activas, ordenadas por deterioro del margen.
- La cartera reutiliza el informe de desvío para calcular margen presupuestado y proyectado sin duplicar fórmulas del dominio.
- Un operador sin `ordenes.ver_margen` recibe la cartera sin los tres campos de margen; una empresa sin órdenes recibe `200` y una lista vacía.
- Se actualizó el contrato OpenAPI. Prompt de sesión vigente: `b3e7221`.

## Decisiones que tomé sobre la marcha

- **Qué decidí:** expresar `avancePct` como `0` hasta la terminación técnica y `100` desde `TERMINADA_TECNICA`. **Qué otra opción había:** inferir avance por actividad económica en cada etapa. **Por qué elegí esta:** las etapas no persisten un estado de finalización y estimarlo inventaría un dato; se aplicó Constitución §2.
- **Qué decidí:** contar como `alertasActivas` las alertas no leídas de la empresa. **Qué otra opción había:** repetir ese conteo por orden o inferir alertas en tiempo de lectura. **Por qué elegí esta:** `Alert` tiene `companyId` pero no relación con `OrdenTrabajo`; el conteo usa el alcance persistido existente y no inventa una asociación, según Constitución §9.
- **Qué decidí:** reutilizar `InformeDesvioOrdenService`. **Qué otra opción había:** copiar su cálculo dentro de la cartera. **Por qué elegí esta:** conserva la misma matemática verificada por FX-OT y evita dos definiciones del margen.

## Dónde el issue no alcanzaba

- No define cómo saber qué etapas están terminadas; `EtapaOrden` no guarda estado ni fecha de finalización.
- No define cómo atribuir una alerta a una orden; `Alert` sólo se relaciona con empresa y estructura de costos.
- La base local compartida tenía una migración fallida previa (`20260925222000_add_inventario_devoluciones_transferencias`). La integración se verificó en un Postgres temporal limpio con la imagen y el rol de aplicación exigidos por el repo.

## Qué quedó afuera

- Avance parcial por etapa y alertas asociadas por orden. Requieren contratos persistentes nuevos; no se abrió otro issue porque esta sesión no amplía el alcance de #481.
- No se modificó el motor de cálculo, el schema de Prisma ni las guardas.

## Con qué se verifica

```text
npm run lint                                # verde
npm run typecheck                           # verde
npm run test                                # 254 archivos; 2072 tests; 1 archivo y 4 tests omitidos
npm run test:http                           # 43 archivos; 222 tests
npm run test:integration                    # 31 archivos; 99 tests con Postgres/RLS reales
npm run check:openapi                       # verde
npm run typecheck:openapi-consumer          # verde
npm run check:tests-base                    # verde
npx vitest run tests/application/cartera-ordenes-service.test.ts tests/http/orden-trabajo.test.ts
                                                # 2 archivos; 17 tests
```
