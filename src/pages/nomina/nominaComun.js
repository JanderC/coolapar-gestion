// Piezas compartidas por los tres sectores de nómina.
// Ubicación sugerida: src/pages/nomina/nominaComun.js

export const MONEDAS = ['BS', 'USD', 'COP'];

export const METODOS_PAGO = [
  { valor: '', etiqueta: 'Sin especificar' },
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'pago_movil', etiqueta: 'Pago móvil' },
  { valor: 'divisas', etiqueta: 'Divisas' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const FRECUENCIAS = [
  { valor: 'semanal', etiqueta: 'Semanal' },
  { valor: 'quincenal', etiqueta: 'Quincenal' },
  { valor: 'mensual', etiqueta: 'Mensual' },
];

/** Traduce un fallo de red o de código a algo legible en pantalla. */
export const detalleError = (err) => {
  if (err?.response) return err.response.data?.message || `El servidor respondió ${err.response.status}.`;
  if (err?.request) return 'El servidor no respondió. Revise la conexión.';
  return err?.message || 'Error desconocido.';
};

/** Monto con su moneda. Nunca se suman monedas distintas. */
export const monto = (valor, moneda = 'BS') =>
  `${Number(valor || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;

/** Suma un objeto { BS: 100, USD: 5 } a texto legible. */
export const montosPorMoneda = (mapa) => {
  const entradas = Object.entries(mapa || {}).filter(([, v]) => Number(v) > 0);
  if (entradas.length === 0) return null;
  return entradas.map(([m, v]) => monto(v, m)).join(' · ');
};

/** Suma (o resta) días a una fecha yyyy-mm-dd, sin líos de zona horaria. */
export const sumarDias = (texto, dias) => {
  const [anio, mes, dia] = String(texto).split('-').map(Number);
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
};

/** Primer día del mes de esa fecha. */
export const inicioDeMes = (texto) => `${String(texto).slice(0, 7)}-01`;

/**
 * Período que le toca a un empleado según su frecuencia, terminando hoy.
 * Es una propuesta: siempre se puede corregir a mano en el formulario.
 */
export const periodoSugerido = (frecuencia, hasta) => {
  const dias = frecuencia === 'mensual' ? 29 : frecuencia === 'quincenal' ? 14 : 6;
  return { inicio: sumarDias(hasta, -dias), fin: hasta };
};
