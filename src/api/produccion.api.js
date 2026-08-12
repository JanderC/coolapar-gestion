import axiosClient from './axiosClient';

export const listarLotes = (params) => axiosClient.get('/produccion', { params }).then((r) => r.data);

export const obtenerResumenPorProducto = () =>
  axiosClient.get('/produccion/resumen-por-producto').then((r) => r.data);

export const obtenerUltimaFormula = (producto) =>
  axiosClient.get('/produccion/ultima-formula', { params: { producto } }).then((r) => r.data);

export const obtenerLote = (id) => axiosClient.get(`/produccion/${id}`).then((r) => r.data);

export const crearLote = (data) => axiosClient.post('/produccion', data).then((r) => r.data);

export const actualizarLote = (id, data) => axiosClient.put(`/produccion/${id}`, data).then((r) => r.data);

export const eliminarLote = (id) => axiosClient.delete(`/produccion/${id}`).then((r) => r.data);