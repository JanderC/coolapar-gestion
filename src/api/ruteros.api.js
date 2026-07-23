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

export const historialRutero = (rutero_id) =>
  axiosClient.get(`${BASE}/historial`, { params: { rutero_id } }).then((r) => r.data);

export const listarPagosRuteros = (filtros = {}) =>
  axiosClient.get(`${BASE}/pagos`, { params: filtros }).then((r) => r.data);