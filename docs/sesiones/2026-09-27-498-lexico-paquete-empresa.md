---
issue: 498
repo: CosteAR-backend
pr: 500
rama: feat/lexico-paquete-empresa
agente: codex
modelo: gpt-5
tanda: C1
inicio: 2026-09-27T16:27:00-03:00
fin: 2026-09-27T16:41:26-03:00
minutos: 14
tokens: no-informado
clears: 0
intentos_hasta_verde: 2
rojos_deliberados: 2
rebotes_de_guarda: 0
---

# 2026-09-27 — El frontend ya puede pedir el léxico de cada empresa

## Recursos

- Prompt vigente de `CosteAR-os`: `b3e7221`.
- Se instalaron dependencias con `npm ci` y se generó Prisma antes de verificar.
- La primera verificación completa reprodujo el timeout conocido de `admin-stats` sin `DATABASE_URL`; con el entorno local explícito pasó completa.
- La base compartida conservaba fallida la migración `20260925222000_add_inventario_devoluciones_transferencias`. No se alteró: la integración corrió sobre la base aislada `costear_issue498`.

## Qué se hizo

- Se publicó `GET /api/v1/companies/{companyId}/paquete-rubro` con `category` y el léxico resuelto.
- La respuesta refleja el override de empresa, omite claves ausentes y no inventa nombres específicos del rubro.
- El acceso a una empresa ajena devuelve 404 después de resolver pertenencia bajo RLS.
- Se generaron `openapi/openapi.json` y `openapi/types.d.ts` desde el schema Zod de la ruta.
- Se agregaron dos pruebas HTTP y un caso de integración que cubre resolución propia y aislamiento cruzado.

## Decisiones que tomé sobre la marcha

- **Qué decidí:** crear una ruta de paquete por empresa en vez de ampliar `modulos-rubro`.
  **Qué otra opción había:** cambiar la forma de la respuesta existente de módulos.
  **Por qué elegí esta:** evita romper consumidores y nombra la superficie por el recurso que publica.
- **Qué decidí:** devolver `category: null` y `lexicon: {}` cuando la empresa no declaró rubro.
  **Qué otra opción había:** devolver nombres canónicos o un error.
  **Por qué elegí esta:** declara la ausencia sin inventar contenido, según Constitución §2.
- **Qué decidí:** exponer sólo valores string presentes en el JSON resuelto.
  **Qué otra opción había:** completar claves desde `CORE_DEFAULTS` o desde una constante del vertical.
  **Por qué elegí esta:** el paquete decide el vocabulario (Constitución §4) y una clave ausente debe seguir ausente (Constitución §2).

## Dónde el issue no alcanzaba

- No fijaba el nombre ni la forma exacta de la ruta; se eligió `/companies/{companyId}/paquete-rubro` con un envelope `{ data: { category, lexicon } }` consistente con el API.
- No definía la respuesta para una empresa sin rubro; se representó la ausencia explícitamente.
- La preparación local no documentaba que una base nueva necesita repetir los grants del rol de aplicación después de migrar; se aplicaron sólo sobre la base aislada de esta sesión.

## Qué quedó afuera

- La pantalla frontend y los flujos de alta/transición de órdenes, expresamente fuera de alcance.
- No se modificaron schema, migraciones, paquetes canónicos ni motor de cálculo.

## Con qué se verifica

```bash
npm run verificar
# 252 archivos unitarios pasaron, 1 omitido; 2062 tests pasaron, 4 omitidos.
# 43 archivos HTTP pasaron; 218 tests pasaron.
# OpenAPI, consumidor tipado y guarda de tests con base pasaron.

DATABASE_URL=postgresql://costear_app:***@localhost:5433/costear_issue498 \
MIGRATION_DATABASE_URL=postgresql://costear:***@localhost:5433/costear_issue498 \
npm run test:integration
# 31 archivos pasaron; 98 tests pasaron con el rol de aplicación NOBYPASSRLS.
```
