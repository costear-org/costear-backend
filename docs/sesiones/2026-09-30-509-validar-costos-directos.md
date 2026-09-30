---
issue: 509
repo: CosteAR-backend
pr: 522
rama: feat/validar-costos-directos
agente: codex
modelo: gpt-5
tanda: C1
inicio: 2026-09-30T19:34-03:00
fin: 2026-09-30T19:49-03:00
minutos: 15
tokens: no-informado
clears: 0
intentos_hasta_verde: 4
rojos_deliberados: 0
rebotes_de_guarda: 0
---

# 2026-09-30 — Los costos directos pendientes ya se pueden resolver

## Qué se hizo

- Se agregaron validación y rechazo para costos directos y contingencias, con conflicto tipado para estados ya resueltos y órdenes cerradas.
- El rechazo conserva el motivo y tanto validar como rechazar auditan dentro de la misma transacción.
- Las contingencias aceptan una unidad de medida de la empresa y publican `null` cuando no fue informada.
- Los listados de costos y contingencias requieren `ordenes.ver_margen` para operadores y exponen un contrato HTTP explícito, sin depender de `passthrough`.
- El cierre deja de bloquearse por filas rechazadas y sigue bloqueándose por pendientes o marcadas.
- Se agregó la migración aditiva para `RECHAZADO`, los motivos de rechazo y la relación opcional con unidades de medida.
- Prompt vigente de la sesión: `dcdfba4`.

## Decisiones que tomé sobre la marcha

- **Qué decidí:** conservar `politicaRetrabajo` en el resultado interno del servicio, pero filtrarlo del contrato HTTP estricto. **Qué otra opción había:** retirarlo también del servicio y cambiar la prueba integrada de `#476`. **Por qué elegí esta:** evita una regresión en consumidores internos y mantiene exactamente los campos públicos pedidos; aplica Constitución §5.
- **Qué decidí:** representar una contingencia sin unidad como `null`. **Qué otra opción había:** inferir una unidad por el tipo de evento. **Por qué elegí esta:** la ausencia debe declararse y la unidad no se inventa; aplica Constitución §2 y §3.
- **Qué decidí:** rechazar cambia el estado y conserva la fila. **Qué otra opción había:** borrar la carga errónea. **Por qué elegí esta:** preserva historia y permite resolver el cierre sin perder evidencia; aplica Constitución §6.
- **Qué decidí:** ejecutar integración sobre `costear_issue509`, con `costear_app` sin `BYPASSRLS`, y reservar el rol dueño para migraciones y `test:db`. **Qué otra opción había:** usar la base local `costear` o correr todo como superusuario. **Por qué elegí esta:** aísla esta sesión y verifica realmente las políticas RLS.

## Dónde el issue no alcanzaba

- El issue enumeraba el contrato HTTP nuevo, pero no aclaraba si los resultados internos del servicio debían perder campos históricos como `politicaRetrabajo`; se preservó internamente por compatibilidad.
- El checkout ya tenía 13 archivos sin commitear en la rama correcta al comenzar esta corrida. Se auditó y continuó ese trabajo porque no existía PR abierto para `#509` y la dependencia `#510` estaba cerrada.
- `.env` contenía integraciones opcionales como cadenas vacías, que el validador interpreta como configuración inválida. Las suites se corrieron con valores efímeros de prueba, sin modificar `.env`.
- Una base nueva creada desde `template0` no hereda los `GRANT` que Docker sólo aplica al inicializar el volumen. Se replicaron esos permisos exclusivamente en `costear_issue509` antes de probar RLS.

## Qué quedó afuera

- La pantalla, los adjuntos del documento y la aprobación de adicionales marcados permanecen fuera de alcance, como define `#509`.
- No se observó un rojo deliberado porque la corrida retomó el checkout con los tests negativos ya escritos; `rojos_deliberados` queda en `0` sin estimarlo.

## Con qué se verifica

```bash
npm run prisma:generate                    # verde
npm run lint                               # verde
npm run typecheck                          # verde
npm run test                               # 2108 pasan, 4 omitidos
npm run test:http                          # 232 pasan
npm run check:openapi                      # verde, 107 operaciones tipadas
npm run typecheck:openapi-consumer         # verde
npm run check:tests-base                   # verde
npm run test:integration                   # 108 pasan con costear_app sin BYPASSRLS
npm run test:db                            # 33 pasan, 34 omitidos con rol dueño
```
