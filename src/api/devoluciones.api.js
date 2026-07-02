import axiosClient from './axiosClient';

export const listarDevoluciones = () => axiosClient.get('/devoluciones').then((r) => r.data);

export const crearDevolucion = (data) => axiosClient.post('/devoluciones', data).then((r) => r.data);
