import axiosClient from './axiosClient';

const BASE = '/equipos';

// Devuelve { equipos, categorias, categorias_sugeridas, totales }
export const listarEquipos = (params) => axiosClient.get(BASE, { params }).then((r) => r.data);

export const obtenerEquipo = (id) => axiosClient.get(`${BASE}/${id}`).then((r) => r.data);

export const crearEquipo = (data) => axiosClient.post(BASE, data).then((r) => r.data);

export const actualizarEquipo = (id, data) => axiosClient.put(`${BASE}/${id}`, data).then((r) => r.data);

// Sumar o restar de a poco mientras se cuenta: { cambio: 1 } o { cambio: -1 }.
// También acepta { cantidad: 12 } para fijar el número de una vez.
export const ajustarCantidadEquipo = (id, data) =>
  axiosClient.patch(`${BASE}/${id}/cantidad`, data).then((r) => r.data);

export const archivarEquipo = (id) => axiosClient.delete(`${BASE}/${id}`).then((r) => r.data);
