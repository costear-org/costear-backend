---
issue: 477
repo: CosteAR-backend
pr: 496
rama: feat/pools-indirectos
agente: codex
modelo: gpt-5
tanda: C1
inicio: 2026-09-26T22:47-03:00
fin: 2026-09-26T23:37-03:00
minutos: 50
tokens: no-informado
clears: 0
intentos_hasta_verde: 3
rojos_deliberados: 1
rebotes_de_guarda: 0
---

# Pools indirectos con costo real auditable

## Qué se hizo

- Se modelaron pools, costos reales append-only, corridas y aplicaciones por orden con migración aditiva y RLS.
- La corrida reutiliza `calcVarianceAnalysis`, guarda la foto de costos reales usada y reparte sólo la variación de presupuesto de pools fabriles.
- Se publicaron las cinco rutas tipadas, con contrato OpenAPI, auditoría transaccional y errores 400/422 accionables.
- Prompt vigente de la sesión: `b3e7221`.

## Decisiones que tomé sobre la marcha

- **Qué decidí:** la corrida recibe `aplicaciones[{ ordenId, cantidadBase }]` junto con el período y persiste el importe calculado.
- **Qué otra opción había:** inferir cada base desde partes de horas u otros módulos.
- **Por qué elegí esta:** sólo horas-hombre tiene hoy una fuente inequívoca; inferir horas-máquina, superficie, días, movimientos u otra base inventaría datos y violaría Constitución §2 y §3. La base explícita conserva unidad semántica por el tipo declarado del pool.
- **Qué decidí:** administración y comercialización conservan corrida y variaciones, pero sus aplicaciones a órdenes tienen importe cero.
- **Qué otra opción había:** cargarlas al costo fabril igual que un pool de taller.
- **Por qué elegí esta:** el criterio 5 las ubica debajo del resultado bruto.

## Dónde el issue no alcanzaba

- El contrato resumía el body de corrida como `{ periodo }`, pero no definía ninguna ruta ni entidad de captura para la base real por orden. Se agregó la lista explícita al mismo request para que todas las bases declaradas sean operables sin inferencias.
- `test:integration` necesitó una base local aislada porque la base compartida tenía una migración fallida ajena. En la base aislada fue necesario otorgar los permisos normales del rol de aplicación; no se modificó la base compartida.
- La primera corrida unitaria completa tuvo un timeout de `admin-stats` porque el proceso no recibió `DATABASE_URL`; con Postgres y Redis declarados pasó 2050/2050.

## Qué quedó afuera

- Variaciones separadas fija/variable, prorrateo primario/secundario real e imputación por estado de la orden, tal como el issue reserva para B4.
- El cierre de orden (#479) y amortizaciones (#375).

## Con qué se verifica

```bash
npm run prisma:generate                         # verde
npm run verificar                               # verde: 2050 unitarios + 211 HTTP; lint/typecheck/OpenAPI/guardas verdes
npx vitest run tests/domain/r5-fixtures.test.ts # verde: 14/14, Piezas mecánicas + tres ITCS
npm run test:integration                        # verde: 96/96, rol sin BYPASSRLS
npm run test:db                                 # verde: 67/67, dueño + sonda RLS
```
