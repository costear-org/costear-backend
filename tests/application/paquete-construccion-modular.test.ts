import { describe, expect, it } from 'vitest';
import {
  CATEGORIA_CONSTRUCCION_MODULAR,
  PAQUETE_CONSTRUCCION_MODULAR,
  evaluarAlertaConstruccionModular,
} from '@/application/operacion/paquete-construccion-modular.js';

describe('paquete de construcción modular', () => {
  it('camino de falla: un umbral sin declarar produce NO_EVALUABLE, no normal', () => {
    const resultado = evaluarAlertaConstruccionModular(
      'margen_en_deterioro',
      { valor: 18, referencia: 25 },
      {},
    );

    expect(resultado).toEqual({
      estado: 'NO_EVALUABLE',
      motivo: 'Falta configurar el parámetro umbral_desvio_margen_pp.',
    });
  });

  it('FX-OT: oferta vencida y costo sin obra disparan las alertas del paquete', () => {
    const parametros = { vigencia_oferta_dias: 7, max_costos_sin_orden: 0 };

    expect(evaluarAlertaConstruccionModular(
      'oferta_vencida',
      { valor: 8 },
      parametros,
    )).toMatchObject({ estado: 'ALERTA', hallazgo: { indicador: 'oferta_vencida' } });
    expect(evaluarAlertaConstruccionModular(
      'costo_sin_orden',
      { valor: 1 },
      parametros,
    )).toMatchObject({ estado: 'ALERTA', hallazgo: { indicador: 'costo_sin_orden' } });
  });

  it('declara las nueve alertas configurables del rubro con etiqueta y severidad', () => {
    expect(PAQUETE_CONSTRUCCION_MODULAR.alertRules.map((regla) => regla.indicador)).toEqual([
      'oferta_vencida', 'salida_sin_stock', 'costo_sin_orden', 'cambio_sin_aprobar',
      'horas_atrasadas', 'posible_duplicado', 'base_faltante', 'margen_en_deterioro',
      'orden_sin_cerrar',
    ]);
    expect(PAQUETE_CONSTRUCCION_MODULAR.alertRules.every(
      (regla) => regla.etiqueta.length > 0 && regla.severidad.length > 0,
    )).toBe(true);
  });

  it('declara los permisos mínimos de órdenes, inventario y horas', () => {
    expect(PAQUETE_CONSTRUCCION_MODULAR.access.permissions).toEqual([
      'ordenes.ver', 'ordenes.editar', 'ordenes.ver_margen', 'ordenes.aprobar_presupuesto',
      'ordenes.cerrar', 'inventario.mover', 'horas.cargar', 'horas.aprobar',
    ]);
    expect(PAQUETE_CONSTRUCCION_MODULAR.access.entities).toEqual(['OrdenTrabajo', 'VersionPresupuesto', 'Deposito']);
  });

  it('camino de falla: un parámetro sin valor declarado queda ausente y sin confirmar', () => {
    const parametro = PAQUETE_CONSTRUCCION_MODULAR.seedParameters
      .find((item) => item.clave === 'umbral_desvio_margen_pp');

    expect(parametro).toEqual(expect.objectContaining({ confirmado: false }));
    expect(parametro).not.toHaveProperty('valor');
  });

  it('declara el léxico, los modelos y las etapas del rubro como datos configurables', () => {
    expect(CATEGORIA_CONSTRUCCION_MODULAR).toBe('CONSTRUCCION_MODULAR');
    expect(PAQUETE_CONSTRUCCION_MODULAR.lexicon).toMatchObject({
      OrdenTrabajo: 'Obra',
      EtapaOrden: 'Etapa',
      Deposito: 'Depósito',
      VersionPresupuesto: 'Adicional',
      PlantillaOrden: 'Modelo',
    });
    expect(PAQUETE_CONSTRUCCION_MODULAR.variants.map((modelo) => modelo.etiqueta)).toEqual([
      'Módulo de 20 pies', 'Módulo de 40 pies', 'Vivienda base', 'Oficina base',
    ]);
    expect(PAQUETE_CONSTRUCCION_MODULAR.variants.every((modelo) => !modelo.confirmado)).toBe(true);
    expect(PAQUETE_CONSTRUCCION_MODULAR.screens.etapasPorDefecto).toHaveLength(7);
    expect(PAQUETE_CONSTRUCCION_MODULAR.screens.etapasPorDefecto.filter((etapa) => etapa.entrega))
      .toHaveLength(2);
  });

  it('mantiene provisionales sin confirmar nombre, parámetros y KPI', () => {
    expect(PAQUETE_CONSTRUCCION_MODULAR.nombreProducto).toBe('Construcción Modular');
    expect(PAQUETE_CONSTRUCCION_MODULAR.nombreProductoConfirmado).toBe(false);
    expect(PAQUETE_CONSTRUCCION_MODULAR.seedParameters.every((parametro) => !parametro.confirmado))
      .toBe(true);
    expect(PAQUETE_CONSTRUCCION_MODULAR.screens.home.kpis.every((kpi) => !kpi.confirmado))
      .toBe(true);
    expect(PAQUETE_CONSTRUCCION_MODULAR.screens.indicadoresMacro).toEqual([]);
  });
});
