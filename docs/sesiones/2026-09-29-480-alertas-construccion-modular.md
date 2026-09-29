---
issue: 480
repo: CosteAR-backend
pr: 504
rama: feat/alertas-construccion-modular-480
agente: codex
modelo: gpt-5
tanda: C1
inicio: 2026-09-29T00:22-03:00
fin: 2026-09-29T00:31-03:00
minutos: 9
tokens: no-informado
clears: 0
intentos_hasta_verde: 2
rojos_deliberados: 1
rebotes_de_guarda: 0
---

# 2026-09-29 — Alertas configurables para las obras modulares

Prompt vigente de CosteAR-os: `b3e7221`.

## Qué se hizo

- Se declararon en el paquete las nueve alertas de Construcción Modular con clave, etiqueta visible,
  unidad, condición, severidad y parámetro de umbral.
- Se agregó un adaptador que reutiliza `ReglaAlerta` para evaluar lecturas del rubro y devuelve
  `NO_EVALUABLE` cuando falta el umbral, en lugar de interpretar la ausencia como cero o normalidad.
- El margen proyectado se convierte en un desvío en puntos porcentuales contra el margen
  presupuestado antes de entrar al evaluador genérico.
- Se cubrieron los disparos de oferta vencida y costo sin obra con FX-OT, además del camino de
  falla exigido por el issue.

## Decisiones que tomé sobre la marcha

- **Qué decidí:** representar todas las alertas como datos del paquete y usar un único adaptador
  hacia el evaluador existente. **Qué otra opción había:** crear nueve evaluadores separados o
  agregar condicionales por rubro al servicio. **Por qué elegí esta:** mantiene al núcleo genérico
  y cumple Constitución §4.
- **Qué decidí:** declarar como parámetros nuevos los umbrales que el issue marcaba configurables,
  con valores iniciales sin confirmar cuando la regla tiene una frontera operativa evidente, y
  dejar `dias_max_cierre_orden` sin valor. **Qué otra opción había:** fijar constantes dentro de
  cada regla. **Por qué elegí esta:** conserva la configuración editable y aplica Constitución §2.
- **Qué decidí:** modelar el deterioro de margen como `presupuestado - proyectado` y compararlo con
  `umbral_desvio_margen_pp`. **Qué otra opción había:** extender el motor con una condición especial.
  **Por qué elegí esta:** reutiliza `MAYOR` y no modifica las fórmulas de costos.

## Dónde el issue no alcanzaba

- No definía severidad por alerta; se eligió `CRITICA` para falta de stock, base y deterioro de
  margen, y `ADVERTENCIA` para las restantes, porque todas avisan y ninguna bloquea una carga.
- No nombraba los parámetros de los seis umbrales nuevos. Se usaron claves genéricas y públicas,
  sin nombres de empresa ni lógica específica de tenant.
- No especificaba cómo expresar el margen proyectado menor al presupuestado con el contrato
  existente; se documentó la normalización a puntos porcentuales de desvío.

## Qué quedó afuera

- Notificaciones por fuera de la app, explícitamente fuera de alcance.
- La producción automática de cada lectura desde los flujos operativos; el alcance de este issue
  es la declaración y evaluación de reglas en el paquete.

## Con qué se verifica

```bash
npx vitest run tests/application/paquete-construccion-modular.test.ts
# rojo deliberado: 3 fallos antes de implementar; verde final: 7/7

npm run lint -- --no-cache
# verde

npm run typecheck
# verde

npm run test
# 253 archivos pasaron, 1 omitido; 2069 tests pasaron, 4 omitidos
```
