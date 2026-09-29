import {
  evaluarReglaDetallada,
  type CondicionAlerta,
  type ResultadoEvaluacionRegla,
  type SeveridadAlerta,
} from '../../domain/alertas/reglas-alerta.js';

export const CATEGORIA_CONSTRUCCION_MODULAR = 'CONSTRUCCION_MODULAR';

interface ReglaAlertaConstruccionModular {
  indicador: string;
  etiqueta: string;
  unidad: string;
  condicion: CondicionAlerta;
  parametroUmbral: string;
  severidad: SeveridadAlerta;
  /** Convierte una lectura compuesta al indicador que compara el motor genérico. */
  lectura?: 'DESVIO_CONTRA_REFERENCIA';
}

const ALERTAS_CONSTRUCCION_MODULAR = [
  { indicador: 'oferta_vencida', etiqueta: 'Oferta vencida', unidad: 'días', condicion: 'MAYOR', parametroUmbral: 'vigencia_oferta_dias', severidad: 'ADVERTENCIA' },
  { indicador: 'salida_sin_stock', etiqueta: 'Salida sin stock', unidad: 'unidades', condicion: 'MENOR', parametroUmbral: 'saldo_minimo_stock', severidad: 'CRITICA' },
  { indicador: 'costo_sin_orden', etiqueta: 'Costo sin obra', unidad: 'cargas', condicion: 'MAYOR', parametroUmbral: 'max_costos_sin_orden', severidad: 'ADVERTENCIA' },
  { indicador: 'cambio_sin_aprobar', etiqueta: 'Cambio sin aprobar', unidad: 'cargas', condicion: 'MAYOR', parametroUmbral: 'max_cambios_sin_aprobar', severidad: 'ADVERTENCIA' },
  { indicador: 'horas_atrasadas', etiqueta: 'Horas atrasadas', unidad: 'días', condicion: 'MAYOR', parametroUmbral: 'dias_max_carga_horas', severidad: 'ADVERTENCIA' },
  { indicador: 'posible_duplicado', etiqueta: 'Posible duplicado', unidad: 'coincidencias', condicion: 'MAYOR', parametroUmbral: 'max_coincidencias_documento', severidad: 'ADVERTENCIA' },
  { indicador: 'base_faltante', etiqueta: 'Base de reparto faltante', unidad: 'pools', condicion: 'MAYOR', parametroUmbral: 'max_pools_sin_base', severidad: 'CRITICA' },
  { indicador: 'margen_en_deterioro', etiqueta: 'Margen en deterioro', unidad: 'pp', condicion: 'MAYOR', parametroUmbral: 'umbral_desvio_margen_pp', severidad: 'CRITICA', lectura: 'DESVIO_CONTRA_REFERENCIA' },
  { indicador: 'orden_sin_cerrar', etiqueta: 'Obra sin cerrar', unidad: 'días', condicion: 'MAYOR', parametroUmbral: 'dias_max_cierre_orden', severidad: 'ADVERTENCIA' },
] as const satisfies readonly ReglaAlertaConstruccionModular[];

export type IndicadorAlertaConstruccionModular = typeof ALERTAS_CONSTRUCCION_MODULAR[number]['indicador'];

/**
 * Adapta las lecturas del rubro al contrato genérico de ReglaAlerta.
 * Un umbral ausente queda declarado: nunca se interpreta como cero ni como normalidad.
 */
export function evaluarAlertaConstruccionModular(
  indicador: IndicadorAlertaConstruccionModular,
  lectura: { valor: number; referencia?: number },
  parametros: Readonly<Record<string, number | undefined>>,
): ResultadoEvaluacionRegla {
  const configuracion = ALERTAS_CONSTRUCCION_MODULAR.find(
    (item) => item.indicador === indicador,
  ) as ReglaAlertaConstruccionModular;
  const umbral = parametros[configuracion.parametroUmbral];
  if (umbral === undefined) {
    return {
      estado: 'NO_EVALUABLE',
      motivo: `Falta configurar el parámetro ${configuracion.parametroUmbral}.`,
    };
  }
  if (configuracion.lectura === 'DESVIO_CONTRA_REFERENCIA' && lectura.referencia === undefined) {
    return {
      estado: 'NO_EVALUABLE',
      motivo: `Falta el valor presupuestado para evaluar ${configuracion.etiqueta.toLocaleLowerCase('es-AR')}.`,
    };
  }

  const valor = configuracion.lectura === 'DESVIO_CONTRA_REFERENCIA'
    ? lectura.referencia! - lectura.valor
    : lectura.valor;
  return evaluarReglaDetallada(
    {
      id: `paquete:${indicador}`,
      indicador,
      descripcion: configuracion.etiqueta,
      condicion: configuracion.condicion,
      umbral,
      unidad: configuracion.unidad,
      lecturasSostenidas: 1,
      severidad: configuracion.severidad,
      activa: true,
    },
    [{ fecha: new Date(0), valor }],
  );
}

/** Contenido declarativo del paquete; no contiene fórmulas ni datos de una empresa. */
export const PAQUETE_CONSTRUCCION_MODULAR = {
  nombreProducto: 'Construcción Modular',
  nombreProductoConfirmado: false,
  lexicon: {
    OrdenTrabajo: 'Obra',
    EtapaOrden: 'Etapa',
    Deposito: 'Depósito',
    VersionPresupuesto: 'Adicional',
    PlantillaOrden: 'Modelo',
  },
  icons: {},
  access: {
    entities: ['OrdenTrabajo', 'VersionPresupuesto', 'Deposito'],
    permissions: [
      'ordenes.ver', 'ordenes.editar', 'ordenes.ver_margen', 'ordenes.aprobar_presupuesto',
      'ordenes.cerrar', 'inventario.mover', 'horas.cargar', 'horas.aprobar',
    ],
    actions: [
      { moduloId: 'inventario', clave: 'mover-inventario', nombre: 'Registrar movimiento de inventario', descripcion: 'Registrá ingresos, salidas, devoluciones o transferencias.', superficie: 'carga.inventario', destino: '/inventario', entidadDestino: 'Deposito', permiso: 'inventario.mover' },
    ],
  },
  variants: [
    { codigo: 'modulo_20_pies', etiqueta: 'Módulo de 20 pies', confirmado: false },
    { codigo: 'modulo_40_pies', etiqueta: 'Módulo de 40 pies', confirmado: false },
    { codigo: 'vivienda_base', etiqueta: 'Vivienda base', confirmado: false },
    { codigo: 'oficina_base', etiqueta: 'Oficina base', confirmado: false },
  ],
  seedParameters: [
    { clave: 'vigencia_oferta_dias', descripcion: 'Días durante los que una oferta conserva vigencia.', valor: 7, unidad: 'dia', seguro: false, confirmado: false },
    { clave: 'frecuencia_revision_precios_dias', descripcion: 'Frecuencia para revisar los precios presupuestados.', valor: 30, unidad: 'dia', seguro: false, confirmado: false },
    { clave: 'umbral_desvio_margen_pp', descripcion: 'Desvío de margen, en puntos porcentuales, que requiere revisión.', seguro: false, confirmado: false },
    { clave: 'umbral_desvio_horas_pct', descripcion: 'Desvío porcentual de horas que requiere revisión.', unidad: '%', seguro: false, confirmado: false },
    { clave: 'dias_max_carga_horas', descripcion: 'Días máximos para cargar las horas trabajadas.', valor: 1, unidad: 'dia', seguro: false, confirmado: false },
    { clave: 'saldo_minimo_stock', descripcion: 'Saldo mínimo permitido luego de una salida.', valor: 0, unidad: 'unidad', seguro: false, confirmado: false },
    { clave: 'max_costos_sin_orden', descripcion: 'Cantidad máxima de costos directos sin obra antes de alertar.', valor: 0, unidad: 'carga', seguro: false, confirmado: false },
    { clave: 'max_cambios_sin_aprobar', descripcion: 'Cantidad máxima de cambios del cliente sin adicional aprobado.', valor: 0, unidad: 'carga', seguro: false, confirmado: false },
    { clave: 'max_coincidencias_documento', descripcion: 'Coincidencias permitidas de un documento o hash.', valor: 1, unidad: 'coincidencia', seguro: false, confirmado: false },
    { clave: 'max_pools_sin_base', descripcion: 'Pools que pueden cerrarse sin una base declarada.', valor: 0, unidad: 'pool', seguro: false, confirmado: false },
    { clave: 'dias_max_cierre_orden', descripcion: 'Días máximos entre la terminación técnica y el cierre de la obra.', unidad: 'dia', seguro: false, confirmado: false },
    { clave: 'umbral_merma_normal_pct', descripcion: 'Porcentaje de merma considerado normal.', valor: 0, unidad: '%', seguro: false, confirmado: false },
    {
      clave: 'deposito_propio', descripcion: '¿Tenés depósito propio de materiales?', tipo: 'texto', confirmado: false,
      opciones: [{ valor: 'si', etiqueta: 'Sí' }, { valor: 'no', etiqueta: 'No' }],
      propuestaModulo: { valores: ['si'], clave: 'inventario' },
    },
    {
      clave: 'montaje_en_destino', descripcion: '¿El montaje en destino lo hace tu gente o lo tercerizás?', tipo: 'texto', confirmado: false,
      opciones: [{ valor: 'propio', etiqueta: 'Lo hace mi equipo' }, { valor: 'tercerizado', etiqueta: 'Lo tercerizo' }],
      propuestaModulo: { valores: ['propio'], clave: 'montaje-propio' },
    },
    {
      clave: 'usa_modelos_estandar', descripcion: '¿Trabajás con modelos estándar además de proyectos a medida?', tipo: 'texto', confirmado: false,
      opciones: [{ valor: 'si', etiqueta: 'Sí' }, { valor: 'no', etiqueta: 'No' }],
      propuestaModulo: { valores: ['si'], clave: 'plantillas' },
    },
    {
      clave: 'obras_mayores_un_mes', descripcion: '¿Tus obras duran más de un mes?', tipo: 'texto', confirmado: false,
      opciones: [{ valor: 'si', etiqueta: 'Sí' }, { valor: 'no', etiqueta: 'No' }],
      aviso: 'Las obras pueden atravesar varios períodos.',
    },
    {
      clave: 'base_pool_fabril', descripcion: '¿Cómo repartís hoy los gastos del taller?', tipo: 'texto', confirmado: false,
      opciones: [
        { valor: 'horas_mano_obra', etiqueta: 'Horas de mano de obra' },
        { valor: 'horas_maquina', etiqueta: 'Horas de máquina' },
        { valor: 'otra', etiqueta: 'Otra base' },
      ],
      hipotesis: true,
    },
  ],
  alertRules: ALERTAS_CONSTRUCCION_MODULAR,
  screens: {
    home: {
      kpis: [
        { clave: 'margen_real_vs_presupuestado', etiqueta: 'Margen real vs. presupuestado de obras activas', confirmado: false },
        { clave: 'costo_vs_presupuesto', etiqueta: 'Costo comprometido e incurrido vs. presupuesto', confirmado: false },
        { clave: 'obras_con_desvio', etiqueta: 'Obras con desvío sobre el umbral', confirmado: false },
      ],
    },
    etapasPorDefecto: [
      { clave: 'metalurgica', etiqueta: 'Metalúrgica', entrega: false },
      { clave: 'aislacion_paneleria', etiqueta: 'Aislación y panelería', entrega: false },
      { clave: 'aberturas', etiqueta: 'Aberturas', entrega: false },
      { clave: 'instalaciones', etiqueta: 'Instalaciones eléctricas y sanitarias', entrega: false },
      { clave: 'terminaciones', etiqueta: 'Terminaciones', entrega: false },
      { clave: 'transporte_logistica', etiqueta: 'Transporte y logística', entrega: true },
      { clave: 'montaje_destino', etiqueta: 'Montaje e instalación en destino', entrega: true },
    ],
    // El núcleo agrega dólar e IPC. No se declara un índice sectorial sin una API verificada.
    indicadoresMacro: [],
  },
  modulos: [
    {
      clave: 'inventario', nombre: 'Inventario', descripcion: 'Controlá materiales en depósito.',
      superficies: [], destinos: {}, parametros: [], alertas: [], dependeDe: [], activoPorDefecto: true,
    },
    {
      clave: 'montaje-propio', nombre: 'Montaje propio', descripcion: 'Registrá horas en destino y viáticos.',
      superficies: [], destinos: {}, parametros: [], alertas: [], dependeDe: [], activoPorDefecto: false,
    },
    {
      clave: 'plantillas', nombre: 'Modelos', descripcion: 'Reutilizá modelos estándar en nuevas obras.',
      superficies: [], destinos: {}, parametros: [], alertas: [], dependeDe: [], activoPorDefecto: false,
    },
    {
      clave: 'configuracion-obras', nombre: 'Configuración de obras', descripcion: 'Completá las hipótesis iniciales del paquete.',
      superficies: [], destinos: {}, parametros: [
        'vigencia_oferta_dias', 'frecuencia_revision_precios_dias', 'umbral_desvio_margen_pp',
        'umbral_desvio_horas_pct', 'dias_max_carga_horas', 'umbral_merma_normal_pct',
        'saldo_minimo_stock', 'max_costos_sin_orden', 'max_cambios_sin_aprobar',
        'max_coincidencias_documento', 'max_pools_sin_base', 'dias_max_cierre_orden',
        'deposito_propio', 'montaje_en_destino', 'usa_modelos_estandar',
        'obras_mayores_un_mes', 'base_pool_fabril',
      ], alertas: [], dependeDe: [], activoPorDefecto: true,
    },
  ],
} as const;
