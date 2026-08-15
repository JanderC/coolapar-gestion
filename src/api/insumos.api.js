import axiosClient from './axiosClient';

// Inventario completo en una sola llamada: la leche que entro por el
// registro diario de los productores mas el catalogo de productos con
// su existencia. Acepta fecha_inicio y fecha_fin para acotar la leche.
export const resumenInventario = (params) =>
  axiosClient.get('/insumos/resumen', { params }).then((r) => r.data);

// ---------- Catálogo ----------   
export const listarInsumos = (params) => axiosClient.get('/insumos', { params }).then((r) => r.data);

export const obtenerInsumo = (id) => axiosClient.get(`/insumos/${id}`).then((r) => r.data);

export const crearInsumo = (data) => axiosClient.post('/insumos', data).then((r) => r.data);

export const actualizarInsumo = (id, data) => axiosClient.put(`/insumos/${id}`, data).then((r) => r.data);

export const eliminarInsumo = (id) => axiosClient.delete(`/insumos/${id}`).then((r) => r.data);

// ---------- Entradas y salidas (compras / consumos) ----------
export const listarMovimientos = (insumoId, params) =>
  axiosClient.get(`/insumos/${insumoId}/movimientos`, { params }).then((r) => r.data);

export const registrarMovimiento = (insumoId, data) =>
  axiosClient.post(`/insumos/${insumoId}/movimientos`, data).then((r) => r.data);

export const anularMovimiento = (movimientoId) =>
  axiosClient.delete(`/insumos/movimientos/${movimientoId}`).then((r) => r.data);

export const descontarLeche = (data) =>
  axiosClient.post('/insumos/leche/descontar', data).then((r) => r.data);

export const restaurarLeche = () =>
  axiosClient.delete('/insumos/leche/descontar').then((r) => r.data);