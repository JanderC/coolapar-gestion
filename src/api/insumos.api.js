import axiosClient from './axiosClient';

// ---------- Catálogo ----------
export const listarInsumos = (params) => axiosClient.get('/insumos', { params }).then((r) => r.data);

export const obtenerInsumo = (id) => axiosClient.get(`/insumos/${id}`).then((r) => r.data);

export const crearInsumo = (data) => axiosClient.post('/insumos', data).then((r) => r.data);

export const actualizarInsumo = (id, data) => axiosClient.put(`/insumos/${id}`, data).then((r) => r.data);

export const eliminarInsumo = (id) => axiosClient.delete(`/insumos/${id}`).then((r) => r.data);

// ---------- Kardex (entradas / salidas) ----------
export const listarMovimientos = (insumoId, params) =>
  axiosClient.get(`/insumos/${insumoId}/movimientos`, { params }).then((r) => r.data);

export const registrarMovimiento = (insumoId, data) =>
  axiosClient.post(`/insumos/${insumoId}/movimientos`, data).then((r) => r.data);

export const anularMovimiento = (movimientoId) =>
  axiosClient.delete(`/insumos/movimientos/${movimientoId}`).then((r) => r.data);