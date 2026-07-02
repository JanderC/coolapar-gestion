import axiosClient from './axiosClient';

export const listarProductores = (activo) =>
  axiosClient.get('/productores', { params: activo !== undefined ? { activo } : {} }).then((r) => r.data);

export const obtenerProductor = (id) => axiosClient.get(`/productores/${id}`).then((r) => r.data);

export const crearProductor = (data) => axiosClient.post('/productores', data).then((r) => r.data);

export const actualizarProductor = (id, data) =>
  axiosClient.put(`/productores/${id}`, data).then((r) => r.data);

export const eliminarProductor = (id) => axiosClient.delete(`/productores/${id}`).then((r) => r.data);
