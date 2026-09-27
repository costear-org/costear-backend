# 0037 — Declarar las acciones operativas en el paquete

- **Fecha:** 2026-09-27
- **Estado:** Aceptada
- **Decide:** equipo de CosteAR, implementado por Codex
- **Contexto de origen:** issue #488

## Contexto

El chat del cargador necesita mostrar sólo acciones que pueda ejecutar sobre entidades que tenga
autorizadas. Las entidades ya estaban modeladas, pero el vínculo entre una acción visible, su ruta
y el tipo de entidad destino no existía. Inferirlo desde nombres, URLs o el rubro en frontend
violaría Constitución §4: el paquete decide qué ve cada rubro.

## Decisión

Cada `PaqueteRubro` declara sus acciones operativas dentro de `access.actions`. Cada acción nombra
el módulo que la habilita, la superficie, el destino, el tipo de entidad y, cuando corresponde, el
permiso funcional. El endpoint expande esa declaración únicamente contra las entidades autorizadas
de la membresía activa.

## Alternativas consideradas

| Alternativa | Por qué no |
| --- | --- |
| Inferir la entidad a partir de la superficie o la URL | Acopla el contrato a convenciones textuales y obliga al frontend a conocer reglas del rubro. |
| Mantener un mapa central en el servicio | Convierte cada rubro nuevo en un cambio de código y contradice que el paquete decida. |
| Agregar una columna nueva a `PaqueteRubro` | `access` ya es el bloque JSON para capacidades; una migración aditiva no aporta aislamiento ni validación adicional. |

## Consecuencias

**A favor**

- El frontend recibe opciones completas y no deduce el destino.
- Los módulos apagados, permisos ausentes y entidades no autorizadas se filtran en un solo lugar.
- Los paquetes existentes pueden incorporar acciones sin migrar el schema.

**En contra / lo que aceptamos pagar**

- La forma interna de `access.actions` se valida en tiempo de ejecución porque vive en JSON.
- Los paquetes sembrados antes de esta decisión necesitan resincronizar el seed; mientras tanto se
  usa la declaración canónica del código como compatibilidad.

**Qué se rompe si alguien la revierte sin leer esto**

- El chat puede ofrecer acciones sobre entidades fuera del alcance o volver a inferir reglas por
  texto, dejando de negar por defecto.

## Cómo se verifica que sigue vigente

`npx vitest run tests/application/operator-scope-service.test.ts` debe probar que el catálogo queda
vacío sin entidades y que una membresía sólo recibe acciones expandidas para su entidad autorizada.
