import axiosClient from './axiosClient';

export const listarTransportadores = (activo) =>
  axiosClient.get('/transportadores', { params: activo !== undefined ? { activo } : {} }).then((r) => r.data);

export const crearTransportador = (data) => axiosClient.post('/transportadores', data).then((r) => r.data);

export const actualizarTransportador = (id, data) =>
  axiosClient.put(`/transportadores/${id}`, data).then((r) => r.data);

export const eliminarTransportador = (id) =>
  axiosClient.delete(`/transportadores/${id}`).then((r) => r.data);
