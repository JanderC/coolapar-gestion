import axiosClient from './axiosClient';

const BASE = '/cuarto-frio';

// Existencia por producto (kilos y piezas) mas los totales.
export const obtenerExistencias = () => axiosClient.get(`${BASE}/existencias`).then((r) => r.data);

// Nombres de producto conocidos, para los selectores.
export const listarProductos = () => axiosClient.get(`${BASE}/productos`).then((r) => r.data);

// Libro completo: entradas de produccion, devoluciones, reprocesos y ajustes.
export const listarMovimientos = (params) =>
  axiosClient.get(`${BASE}/movimientos`, { params }).then((r) => r.data);

// ---------- Devoluciones ----------
export const listarDevoluciones = (params) =>
  axiosClient.get(`${BASE}/devoluciones`, { params }).then((r) => r.data);

export const registrarDevolucion = (data) =>
  axiosClient.post(`${BASE}/devoluciones`, data).then((r) => r.data);

export const anularDevolucion = (id) =>
  axiosClient.delete(`${BASE}/devoluciones/${id}`).then((r) => r.data);

// ---------- Ajuste manual ----------
// Para cuadrar contra un conteo fisico o anotar una perdida.
export const registrarAjuste = (data) => axiosClient.post(`${BASE}/ajustes`, data).then((r) => r.data);