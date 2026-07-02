import axiosClient from './axiosClient';

export const listarProductos = (activo) =>
  axiosClient.get('/productos', { params: activo !== undefined ? { activo } : {} }).then((r) => r.data);

export const crearProducto = (data) => axiosClient.post('/productos', data).then((r) => r.data);

export const actualizarProducto = (id, data) =>
  axiosClient.put(`/productos/${id}`, data).then((r) => r.data);

export const eliminarProducto = (id) => axiosClient.delete(`/productos/${id}`).then((r) => r.data);
