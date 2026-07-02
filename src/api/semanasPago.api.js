import axiosClient from './axiosClient';

export const listarSemanas = () => axiosClient.get('/semanas-pago').then((r) => r.data);

export const obtenerSemanaActual = () =>
  axiosClient.get('/semanas-pago/actual').then((r) => r.data).catch(() => ({ data: null }));

export const abrirSemana = (fecha_inicio) =>
  axiosClient.post('/semanas-pago', { fecha_inicio }).then((r) => r.data);

export const cerrarSemana = (id, fecha_fin) =>
  axiosClient.put(`/semanas-pago/${id}/cerrar`, { fecha_fin }).then((r) => r.data);
