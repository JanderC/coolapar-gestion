import axiosClient from './axiosClient';

export const listarLotesProduccion = () => axiosClient.get('/lotes-produccion').then((r) => r.data);

export const historialPorcentajeLitroKilo = () =>
  axiosClient.get('/lotes-produccion/historial-porcentaje').then((r) => r.data);

export const crearLoteProduccion = (data) =>
  axiosClient.post('/lotes-produccion', data).then((r) => r.data);

export const actualizarLoteProduccion = (id, data) =>
  axiosClient.put(`/lotes-produccion/${id}`, data).then((r) => r.data);

export const registrarElaboracion = (loteId, data) =>
  axiosClient.post(`/lotes-produccion/${loteId}/elaboracion`, data).then((r) => r.data);
