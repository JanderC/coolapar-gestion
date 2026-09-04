import axiosClient from './axiosClient';

const BASE = '/ruteros';

// Ficha del rutero
export const listarRuteros = (filtros = {}) =>
  axiosClient.get(BASE, { params: filtros }).then((r) => r.data);

export const obtenerRutero = (id) => axiosClient.get(`${BASE}/${id}`).then((r) => r.data);
export const crearRutero = (data) => axiosClient.post(BASE, data).then((r) => r.data);
export const actualizarRutero = (id, data) => axiosClient.put(`${BASE}/${id}`, data).then((r) => r.data);
export const eliminarRutero = (id) => axiosClient.delete(`${BASE}/${id}`).then((r) => r.data);

// Hoja semanal: litros, sobrante, faltante, descripción
export const obtenerHojaRutero = (params) => axiosClient.get(`${BASE}/hoja`, { params }).then((r) => r.data);

export const guardarHojaRutero = (data) => axiosClient.post(`${BASE}/hoja`, data).then((r) => r.data);

export const registrarPagoRutero = (data) => axiosClient.post(`${BASE}/hoja/pago`, data).then((r) => r.data);

// Hoja de SOLO LECTURA: no crea ni ajusta semanas, a diferencia de
// obtenerHojaRutero. Es la que se usa para consultar e imprimir.
// Acepta { rutero_id, semana_id } o { rutero_id, fecha_inicio, fecha_fin }.
export const hojaConsultaRutero = (params) =>
  axiosClient.get(`${BASE}/hoja-consulta`, { params }).then((r) => r.data);

// Todos los ruteros que trajeron leche en un rango, con su litraje día
// por día. Solo lectura: no crea ni ajusta semanas.
export const resumenSemanaRuteros = (params) =>
  axiosClient.get(`${BASE}/resumen-semana`, { params }).then((r) => r.data);

// filtros: { estado_pago: 'pagado' | 'pendiente', fecha_inicio, fecha_fin, limite }
// Devuelve { data: [...semanas], resumen: {...} }
export const historialRutero = (rutero_id, filtros = {}) =>
  axiosClient.get(`${BASE}/historial`, { params: { rutero_id, ...filtros } }).then((r) => r.data);

export const listarPagosRuteros = (filtros = {}) =>
  axiosClient.get(`${BASE}/pagos`, { params: filtros }).then((r) => r.data);

export const eliminarSemanaRutero = (id, forzar = false) =>
  axiosClient.delete(`/ruteros/semanas/${id}`, forzar ? { params: { forzar: 'true' } } : undefined);
 
export const limpiarSemanasVaciasRutero = (ruteroId) =>
  axiosClient.delete('/ruteros/semanas/vacias', ruteroId ? { params: { rutero_id: ruteroId } } : undefined);
 