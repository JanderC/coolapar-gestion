// Mismo orden que getDay() de JavaScript: 0 = domingo.
export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Para los desplegables: la semana de trabajo arranca en lunes.
export const OPCIONES_DIA = [1, 2, 3, 4, 5, 6, 0].map((valor) => ({ valor, nombre: DIAS[valor] }));

export const vacio = (v) => v === undefined || v === null || v === '';

export const nombreDia = (n) => DIAS[Number(n)] || '';

/** "Lunes a Miércoles" o "Martes" si es un solo día. */
export const etiquetaDias = (inicio, fin) => {
  if (vacio(inicio) || vacio(fin)) return '';
  return Number(inicio) === Number(fin)
    ? nombreDia(inicio)
    : `${nombreDia(inicio)} a ${nombreDia(fin)}`;
};

/** Cuántos días abarca el ciclo: lunes a miércoles = 3. */
export const largoCiclo = (inicio, fin) => ((Number(fin) - Number(inicio) + 7) % 7) + 1;

export const formatoCorto = (fechaTexto) => {
  if (!fechaTexto) return '';
  const [a, m, d] = String(fechaTexto).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/** Desempaqueta { success, data } venga o no envuelto por la instancia de axios. */
export const desempacar = (respuesta) => respuesta?.data?.data ?? respuesta?.data ?? null;

export const aNumero = (valor, porDefecto = 0) => {
  if (vacio(valor)) return porDefecto;
  const n = Number(valor);
  return Number.isNaN(n) ? porDefecto : n;
};