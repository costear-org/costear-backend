---
issue: 508
repo: CosteAR-backend
pr: 521
rama: feat/deducir-tarifa-partes
agente: codex
modelo: gpt-5
tanda: C1
inicio: 2026-09-30T15:48:30-03:00
fin: 2026-09-30T16:05:38-03:00
minutos: 17
tokens: no-informado
clears: 0
intentos_hasta_verde: 4
rojos_deliberados: 1
rebotes_de_guarda: 0
---

# 2026-09-30 — La tarifa del parte la decide el servidor

## Qué se hizo

- El alta de partes dejó de aceptar `tarifaId`: resuelve la tarifa vigente de la categoría de la persona, o la general si la persona no tiene categoría.
- La ausencia de tarifa devuelve `TARIFA_VIGENTE_AUSENTE` con persona y fecha; una persona inactiva o de otra empresa devuelve 422 y no crea el parte.
- Planta puede listar etapas y partes con `ordenes.ver`, `horas.cargar` o `horas.aprobar`, sin recibir claves de tarifa ni importe.
- Una migración aditiva detecta partes históricos sin persona con un mensaje explícito y valida la clave foránea creada en #507.
- El fixture FX-OT conservó MOD 675.000 y demostró la vigencia con tarifas del 1/9 y 15/9.

## Decisiones que tomé sobre la marcha

- **Qué decidí:** usar `PERSONA_NO_DISPONIBLE` para persona inexistente o de otra empresa y conservar `INACTIVE_PERSON` para una inactiva. **Qué otra opción había:** devolver un único código para las tres causas. **Por qué elegí esta:** mantiene el código ya publicado para inactividad y evita revelar si un UUID pertenece a otra empresa; aplica Constitución §2.
- **Qué decidí:** hacer opcional `tarifaId` sólo en el schema de respuesta compartido, aunque el administrador siempre lo recibe. **Qué otra opción había:** duplicar todos los envelopes por rol. **Por qué elegí esta:** OpenAPI describe correctamente que planta no lo recibe sin multiplicar contratos idénticos.
- **Qué decidí:** validar la FK en una migración nueva con un chequeo previo, sin reescribir la migración ya mergeada de #507. **Qué otra opción había:** editar la migración anterior. **Por qué elegí esta:** conserva historia y mantiene el cambio aditivo.
- **Qué decidí:** escribir primero los casos negativos y comprobar cinco fallas antes de implementar. **Qué otra opción había:** implementar antes de verlos fallar. **Por qué elegí esta:** Constitución §5 exige rojo antes que verde.

## Dónde el issue no alcanzaba

- No especificaba el código del 422 para una persona inexistente o de otra empresa; se eligió `PERSONA_NO_DISPONIBLE` y se documentó arriba.
- #507 había creado la FK como `NOT VALID`, mientras #508 exige que bases con huérfanos fallen. Se resolvió sin modificar historia: el nuevo paso detecta huérfanos y luego ejecuta `VALIDATE CONSTRAINT`.
- La base local por defecto tenía una migración vieja fallida y los nombres de contenedor ya estaban ocupados. Se creó `costear_issue508`, sin borrar ni alterar esa base, y se otorgaron al rol de pruebas los permisos necesarios.
- El primer `npm run verificar` encontró seis secretos opcionales vacíos en `.env`; se repitió con valores `test-only` sólo en el proceso, sin editar credenciales.
- Prompt vigente de CosteAR-os: `dcdfba4`.

## Qué quedó afuera

- Recalcular partes históricos cuando se agregan tarifas nuevas y ociosidad por horas-hombre, ambos fuera de alcance explícito.
- No se abrió ningún issue adicional.

## Con qué se verifica

```bash
npm run prisma:generate
# verde

npm run verificar
# verde: lint, typecheck, 2100 unitarios, 228 HTTP, OpenAPI/consumer y guardas

MIGRATION_DATABASE_URL=postgresql://costear:costear@localhost:5433/costear_issue508 \
DATABASE_URL=postgresql://costear_app:costear_app@localhost:5433/costear_issue508 \
npm run test:integration
# verde: 33 archivos, 107 tests, RLS aplicada con rol sin BYPASSRLS
```
