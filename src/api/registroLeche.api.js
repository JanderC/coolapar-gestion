import axiosClient from './axiosClient';

export const listarRegistrosLeche = (filtros = {}) =>
  axiosClient.get('/registros-leche', { params: filtros }).then((r) => r.data);

export const crearRegistroLeche = (data) =>
  axiosClient.post('/registros-leche', data).then((r) => r.data);

export const actualizarRegistroLeche = (id, data) =>
  axiosClient.put(`/registros-leche/${id}`, data).then((r) => r.data);

export const eliminarRegistroLeche = (id) =>
  axiosClient.delete(`/registros-leche/${id}`).then((r) => r.data);
