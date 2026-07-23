import axiosClient from './axiosClient';

const BASE = '/registros-leche';

// ---------- Semanas ----------
export const listarSemanas = () => axiosClient.get(`${BASE}/semanas`).then((r) => r.data);

export const abrirSemana = (data) => axiosClient.post(`${BASE}/semanas`, data).then((r) => r.data);

export const cerrarSemana = (id) => axiosClient.patch(`${BASE}/semanas/${id}/cerrar`).then((r) => r.data);

// ---------- Hoja semanal del productor ----------
export const obtenerHoja = (productor_id, semana_id) =>
  axiosClient.get(`${BASE}/hoja`, { params: { productor_id, semana_id } }).then((r) => r.data);

export const guardarHoja = (data) => axiosClient.post(`${BASE}/hoja`, data).then((r) => r.data);

export const registrarPagoSemana = (data) => axiosClient.post(`${BASE}/hoja/pago`, data).then((r) => r.data);

export const resumenSemana = (semana_id) =>
  axiosClient.get(`${BASE}/resumen`, { params: { semana_id } }).then((r) => r.data);

// ---------- Registros sueltos ----------
export const listarRegistrosLeche = (filtros = {}) =>
  axiosClient.get(BASE, { params: filtros }).then((r) => r.data);

export const crearRegistroLeche = (data) => axiosClient.post(BASE, data).then((r) => r.data);

export const actualizarRegistroLeche = (id, data) =>
  axiosClient.put(`${BASE}/${id}`, data).then((r) => r.data);

export const eliminarRegistroLeche = (id) => axiosClient.delete(`${BASE}/${id}`).then((r) => r.data);