import axiosClient from './axiosClient';

export const listarInsumos = () => axiosClient.get('/insumos').then((r) => r.data);

export const crearInsumo = (data) => axiosClient.post('/insumos', data).then((r) => r.data);

export const actualizarInsumo = (id, data) => axiosClient.put(`/insumos/${id}`, data).then((r) => r.data);

export const eliminarInsumo = (id) => axiosClient.delete(`/insumos/${id}`).then((r) => r.data);
