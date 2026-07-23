export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const vacio = (v) => v === undefined || v === null || v === '';

/** 'YYYY-MM-DD' en hora local (evita el corrimiento de un día de toISOString). */
export const aTexto = (fecha) => {
  const d = fecha instanceof Date ? fecha : new Date(`${fecha}T00:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const hoy = () => aTexto(new Date());

export const nombreDia = (fechaTexto) => DIAS[new Date(`${fechaTexto}T00:00:00`).getDay()];

/** Lunes de la semana en que cae la fecha dada. */
export const lunesDe = (fecha = new Date()) => {
  const d = fecha instanceof Date ? new Date(fecha) : new Date(`${fecha}T00:00:00`);
  const diferencia = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - diferencia);
  return aTexto(d);
};

export const sumarDias = (fechaTexto, cantidad) => {
  const d = new Date(`${fechaTexto}T00:00:00`);
  d.setDate(d.getDate() + cantidad);
  return aTexto(d);
};

export const rangoFechas = (inicio, fin, maximo = 31) => {
  const dias = [];
  const cursor = new Date(`${inicio}T00:00:00`);
  const limite = new Date(`${fin}T00:00:00`);
  while (cursor <= limite && dias.length < maximo) {
    dias.push(aTexto(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
};

export const formatoCorto = (fechaTexto) => {
  if (!fechaTexto) return '';
  const [a, m, d] = String(fechaTexto).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

export const etiquetaSemana = (semana) =>
  semana ? `${formatoCorto(semana.fecha_inicio)} al ${formatoCorto(semana.fecha_fin)}` : '';

/** Desempaqueta { success, data } venga o no envuelto por la instancia de axios. */
export const desempacar = (respuesta) => respuesta?.data?.data ?? respuesta?.data ?? null;

export const aNumero = (valor, porDefecto = 0) => {
  if (vacio(valor)) return porDefecto;
  const n = Number(valor);
  return Number.isNaN(n) ? porDefecto : n;
};
