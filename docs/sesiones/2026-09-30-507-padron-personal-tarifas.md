---
issue: 507
repo: CosteAR-backend
pr: 520
rama: feat/padron-personal-tarifas
agente: codex
modelo: gpt-5
tanda: C1
inicio: 2026-09-30T14:11:08-03:00
fin: 2026-09-30T15:31:53-03:00
minutos: 81
tokens: no-informado
clears: 0
intentos_hasta_verde: 4
rojos_deliberados: 1
rebotes_de_guarda: 0
---

# 2026-09-30 — El padrón y las tarifas de mano de obra ya se cargan por API

## Recursos

La sesión usó el prompt vigente `dcdfba4`. La base desechable fue `costear_issue507`, con las
pruebas de integración ejecutadas mediante el rol `costear_app` sin `BYPASSRLS`.

## Qué se hizo

- Se agregaron categorías configurables, personas sin cuenta y tarifas de mano de obra por
  categoría y vigencia.
- Se publicaron siete operaciones HTTP con contratos OpenAPI: categorías, personas y tarifas.
- Los operadores con `horas.cargar` o `horas.aprobar` pueden leer el padrón, pero no administrar
  personas ni ver tarifas o importes.
- `tarifaHora` sale del `calcDepartmentMod` existente; el caso FX-OT devuelve exactamente 5.000.
- Las mutaciones auditan dentro de su transacción y las tablas nuevas quedaron cubiertas por RLS.
- Los partes nuevos exigen una persona activa del mismo negocio.

## Decisiones que tomé sobre la marcha

- **Qué decidí:** crear la FK desde partes hacia personas como `NOT VALID`, aunque se aplica a
  toda fila nueva. **Qué otra opción había:** inventar personas para cada UUID histórico o impedir
  la migración hasta limpiar datos. **Por qué elegí esta:** conserva los hechos previos sin
  fabricar nombres ni bloquear el cambio aditivo (Constitución §2 y §5; DOM-01 y DOM-06).
- **Qué decidí:** usar un índice único PostgreSQL `NULLS NOT DISTINCT` para la combinación empresa,
  categoría y vigencia. **Qué otra opción había:** confiar sólo en la comprobación del servicio,
  que deja una carrera entre requests. **Por qué elegí esta:** también protege la tarifa general,
  cuya categoría nula no queda cubierta por un índice único SQL convencional.
- **Qué decidí:** resolver el permiso de lectura del padrón con una consulta `hasSome` para
  `horas.cargar` o `horas.aprobar`. **Qué otra opción había:** intentar permisos en serie.
  **Por qué elegí esta:** evita registrar un rechazo intermedio válido y hace explícita la regla
  de acceso (Constitución §7).

## Dónde el issue no alcanzaba

- No indicaba cómo migrar los `personaId` históricos, que antes eran UUID sin tabla de referencia;
  se preservaron con una FK `NOT VALID` que sí controla cada alta futura.
- No aclaraba la semántica SQL del único de tarifa general (`categoriaId = null`); se trató null
  como un valor comparable para que haya una sola tarifa general por fecha.
- `prisma migrate dev --create-only` no pudo ejecutarse de forma interactiva en esta automatización;
  la migración se derivó contra una base desechable, se limitó a sentencias aditivas y se verificó
  completa con `migrate deploy` y `db:setup`.

## Qué quedó afuera

- La deducción automática de tarifa al cargar un parte corresponde a #508.
- No se agregó edición ni borrado de tarifas: continúan siendo snapshots append-only.
- No se inventaron nombres para las personas históricas sin padrón.

## Con qué se verifica

```bash
npm run lint                         # verde
npm run typecheck                    # verde
npm run test                         # 2094 pasaron, 4 omitidos
npm run test:http                    # 224 pasaron
npm run test:integration             # 107 pasaron con rol sin BYPASSRLS
npm run check:tests-base             # verde
npm run check:openapi                # 103 operaciones tipadas; artefactos sincronizados
npx vitest run tests/http/personal.test.ts tests/personal-contract.test.ts
                                       # 10 pasaron
npx vitest run --config vitest.integration.config.ts tests/integration/personal-service.test.ts
                                       # 3 pasaron
```
