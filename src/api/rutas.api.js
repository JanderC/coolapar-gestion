import axiosClient from './axiosClient';

export const listarRutas = (activo) =>
  axiosClient.get('/rutas', { params: activo !== undefined ? { activo } : {} }).then((r) => r.data);

export const obtenerRuta = (id) => axiosClient.get(`/rutas/${id}`).then((r) => r.data);

export const crearRuta = (data) => axiosClient.post('/rutas', data).then((r) => r.data);

export const actualizarRuta = (id, data) => axiosClient.put(`/rutas/${id}`, data).then((r) => r.data);

export const eliminarRuta = (id) => axiosClient.delete(`/rutas/${id}`).then((r) => r.data);