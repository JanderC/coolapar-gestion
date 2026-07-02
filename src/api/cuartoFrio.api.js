import axiosClient from './axiosClient';

export const listarCuartoFrio = (estado) =>
  axiosClient.get('/cuarto-frio', { params: estado ? { estado } : {} }).then((r) => r.data);

export const obtenerCuartoFrio = (id) => axiosClient.get(`/cuarto-frio/${id}`).then((r) => r.data);

export const crearCuartoFrio = (data) => axiosClient.post('/cuarto-frio', data).then((r) => r.data);

export const retirarCuartoFrio = (id, data) =>
  axiosClient.put(`/cuarto-frio/${id}/retirar`, data).then((r) => r.data);
