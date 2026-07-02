import axiosClient from './axiosClient';

export const listarPagosProductores = (filtros = {}) =>
  axiosClient.get('/pagos-productores', { params: filtros }).then((r) => r.data);

export const generarLiquidacion = (productor_id, semana_id) =>
  axiosClient.post('/pagos-productores/generar', { productor_id, semana_id }).then((r) => r.data);

export const generarLiquidacionesSemana = (semana_id) =>
  axiosClient.post('/pagos-productores/generar-semana', { semana_id }).then((r) => r.data);

export const marcarPagoComoPagado = (id, fecha_pago) =>
  axiosClient.put(`/pagos-productores/${id}/pagar`, { fecha_pago }).then((r) => r.data);
