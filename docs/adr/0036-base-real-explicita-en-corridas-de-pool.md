# ADR 0036 — Base real explícita en corridas de pools

## Estado

Aceptado — 2026-09-26.

## Contexto

El pool declara el tipo de base, pero el sistema sólo puede derivar horas-hombre de manera inequívoca. No existe una fuente común para horas-máquina, superficie, días de ocupación, movimientos u otra base. La corrida necesita cantidades por orden para aplicar la cuota y repartir la variación de presupuesto.

## Decisión

`POST /pools-indirectos/{id}/corridas` recibe el período y una lista `aplicaciones` con `ordenId` y `cantidadBase`. La corrida valida que las órdenes pertenezcan a la empresa, calcula con el tipo de base declarado por el pool y persiste las cantidades e importes como snapshot.

El importe aplicado a órdenes incluye cuota predeterminada más variación de presupuesto proporcional sólo para pools `FABRIL`. En `ADMINISTRACION` y `COMERCIALIZACION` se conserva el análisis, pero el importe aplicado a cada orden es cero.

## Alternativas descartadas

- Inferir horas-hombre desde partes y dejar las demás bases sin operar: haría que el mismo contrato cambiara de comportamiento según la base.
- Inferir las otras bases desde datos cercanos: violaría Constitución §2 y §3 porque esos datos no existen ni llevan la unidad requerida.
- Crear una ruta adicional de mediciones: aumenta el alcance sin que el issue defina ciclo de vida, correcciones ni auditoría de esas mediciones.

## Consecuencias

- Todas las bases son operables y auditables hoy.
- El llamador debe aportar cantidades reales por orden.
- Una futura entidad versionada de mediciones puede alimentar el mismo request sin cambiar la matemática ni el snapshot persistido.
