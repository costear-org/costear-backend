---
issue: 478
repo: CosteAR-backend
pr: 499
rama: feat/informe-desvio-orden
agente: codex
modelo: gpt-5
tanda: C1
inicio: 2026-09-27T12:24-03:00
fin: 2026-09-27T12:43-03:00
minutos: 19
tokens: no-informado
clears: 0
intentos_hasta_verde: 2
rojos_deliberados: 1
rebotes_de_guarda: 0
---

# 2026-09-27 — El informe de la orden explica cuánto se corrió y por qué

## Qué se hizo

- Se agregó `GET /ordenes-trabajo/{id}/informe-desvio`, con presupuesto y costo real por MP,
  MOD, CIF y entrega, puente favorable/desfavorable y proyección al terminar.
- FX-OT da costo total 1.565.000, precio contractual 2.250.000, margen esperado 750.000,
  margen real 685.000 y desvío 65.000 desfavorable.
- El informe compone los hechos ya valuados por inventario PPP, partes aprobados, costos directos
  validados y aplicaciones de pools fabriles; no modifica el motor de cálculo.
- Un operador necesita `ordenes.ver` sobre la orden. Sin `ordenes.ver_margen`, el contrato omite
  precio contractual y ambos márgenes. Un usuario de planta sin acceso recibe 403.
- Se publicó el contrato OpenAPI y se agregó una prueba con PostgreSQL y RLS real.

## Decisiones que tomé sobre la marcha

- **Qué decidí:** usar los importes históricos ya materializados por cada servicio.
  **Qué otra opción había:** volver a calcular PPP, MOD o pools dentro del informe.
  **Por qué elegí esta:** evita duplicar el motor y conserva exactamente la política vigente al
  momento de registrar cada hecho.
- **Qué decidí:** mapear `CIP` del presupuesto a `CIF` en el contrato del informe y excluir pools
  administrativos/comerciales.
  **Qué otra opción había:** exponer los nombres internos o sumar todo pool aplicado.
  **Por qué elegí esta:** el issue pide CIF fabril y la dependencia #477 ya separa los pools que
  no forman costo de la orden.
- **Qué decidí:** mientras la orden no está terminada técnicamente, el comprometido es el saldo
  positivo entre presupuesto y real por elemento; al terminar técnicamente queda en cero.
  **Qué otra opción había:** inventar un estado por etapa o agregar una migración no pedida.
  **Por qué elegí esta:** el modelo actual no registra finalización por etapa y la alternativa
  ampliaba el alcance. El valor queda separado de `incurrido`, conforme Constitución §2.
- **Qué decidí:** atribuir el puente agregado de MP a precio, MOD a eficiencia, CIF a asignación y
  entrega a alcance.
  **Qué otra opción había:** repartir precio/cantidad sin trazabilidad entre renglones de
  presupuesto y artículos.
  **Por qué elegí esta:** los datos existentes permiten explicar esas causas sin inventar un
  reparto más granular; el total sigue cuadrando al peso.

## Dónde el issue no alcanzaba

- No define cómo reconocer una etapa terminada y `EtapaOrden` no tiene estado. Se usó el estado
  técnico de la orden y el saldo por elemento para la proyección.
- No existe una relación entre cada renglón presupuestado de MP y cada artículo de inventario;
  por eso el puente no divide el desvío de MP entre precio y cantidad.
- La base local compartida tenía una migración fallida previa. La integración se verificó en la
  base aislada `costear_issue478`, sin modificar ni resolver el historial compartido.
- Prompt vigente de la sesión: `b3e7221`.

## Qué quedó afuera

- El cierre de la orden (#479) y la cartera (#481), según el alcance explícito del issue.
- Un estado por etapa y un enlace presupuesto-artículo, porque requieren contratos y migraciones
  que #478 no pidió.

## Con qué se verifica

```bash
npm run prisma:generate
npm test -- --run tests/application/informe-desvio-orden-service.test.ts tests/http/orden-trabajo.test.ts
# 2 archivos, 14 tests verdes; antes de implementar, el endpoint daba 404 y el servicio no existía.

$env:DATABASE_URL='postgresql://costear_app:costear_app@localhost:5433/costear_issue478'
npm run test:integration -- --run tests/integration/orden-trabajo-service.test.ts
# 1 archivo, 8 tests verdes con rol NOBYPASSRLS.

npm run verificar
# lint y typecheck verdes; 2.060 unitarios, 216 HTTP, OpenAPI y guardas verdes.
```
