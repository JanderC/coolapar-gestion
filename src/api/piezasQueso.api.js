import axiosClient from './axiosClient';

export const listarPiezasQueso = (cuarto_frio_id) =>
  axiosClient
    .get('/piezas-queso', { params: cuarto_frio_id ? { cuarto_frio_id } : {} })
    .then((r) => r.data);

export const crearPiezaQueso = (data) => axiosClient.post('/piezas-queso', data).then((r) => r.data);

export const registrarPesoPieza = (id, data) =>
  axiosClient.post(`/piezas-queso/${id}/pesar`, data).then((r) => r.data);
