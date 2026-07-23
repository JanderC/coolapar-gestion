import axiosClient from './axiosClient';

const BASE = '/registros-leche';

// Hoja de la semana. Se pide por días (dia_inicio / dia_fin) o por semana_id
// cuando se reabre una del historial.
export const obtenerHoja = (params) => axiosClient.get(`${BASE}/hoja`, { params }).then((r) => r.data);

export const guardarHoja = (data) => axiosClient.post(`${BASE}/hoja`, data).then((r) => r.data);

export const registrarPagoSemana = (data) => axiosClient.post(`${BASE}/hoja/pago`, data).then((r) => r.data);

export const historialProductor = (productor_id) =>
  axiosClient.get(`${BASE}/historial`, { params: { productor_id } }).then((r) => r.data);

export const cambiarEstadoSemana = (id, estado) =>
  axiosClient.patch(`${BASE}/semanas/${id}/estado`, { estado }).then((r) => r.data);

// Registros sueltos
export const listarRegistrosLeche = (filtros = {}) =>
  axiosClient.get(BASE, { params: filtros }).then((r) => r.data);

export const eliminarRegistroLeche = (id) => axiosClient.delete(`${BASE}/${id}`).then((r) => r.data);