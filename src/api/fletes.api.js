import axiosClient from './axiosClient';

export const listarFletes = (transportador_id) =>
  axiosClient
    .get('/fletes', { params: transportador_id ? { transportador_id } : {} })
    .then((r) => r.data);

export const crearFlete = (data) => axiosClient.post('/fletes', data).then((r) => r.data);

export const actualizarFlete = (id, data) => axiosClient.put(`/fletes/${id}`, data).then((r) => r.data);
