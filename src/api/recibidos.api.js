import axiosClient from './axiosClient';

export const listarRecibidos = () => axiosClient.get('/recibidos').then((r) => r.data);

export const obtenerRecibido = (id) => axiosClient.get(`/recibidos/${id}`).then((r) => r.data);

export const crearRecibido = (data) => axiosClient.post('/recibidos', data).then((r) => r.data);

export const actualizarRecibido = (id, data) =>
  axiosClient.put(`/recibidos/${id}`, data).then((r) => r.data);
