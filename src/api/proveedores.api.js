import axiosClient from './axiosClient';

export const listarProveedores = (activo) =>
  axiosClient.get('/proveedores', { params: activo !== undefined ? { activo } : {} }).then((r) => r.data);

export const crearProveedor = (data) => axiosClient.post('/proveedores', data).then((r) => r.data);

export const actualizarProveedor = (id, data) =>
  axiosClient.put(`/proveedores/${id}`, data).then((r) => r.data);

export const eliminarProveedor = (id) => axiosClient.delete(`/proveedores/${id}`).then((r) => r.data);
