import axiosClient from './axiosClient';

const BASE = '/nomina';

// ---------- Sector 1: empleados y nómina ----------
export const listarEmpleados = (params) => axiosClient.get(`${BASE}/empleados`, { params }).then((r) => r.data);

export const crearEmpleado = (data) => axiosClient.post(`${BASE}/empleados`, data).then((r) => r.data);

export const actualizarEmpleado = (id, data) =>
  axiosClient.put(`${BASE}/empleados/${id}`, data).then((r) => r.data);

export const archivarEmpleado = (id) => axiosClient.delete(`${BASE}/empleados/${id}`).then((r) => r.data);

export const listarRecibos = (params) => axiosClient.get(`${BASE}/recibos`, { params }).then((r) => r.data);

// Cuánto se le debe si se le hiciera el recibo hoy, con sus adelantos.
export const previsualizarRecibo = (empleadoId, params) =>
  axiosClient.get(`${BASE}/recibos/previsualizar/${empleadoId}`, { params }).then((r) => r.data);

export const crearRecibo = (data) => axiosClient.post(`${BASE}/recibos`, data).then((r) => r.data);

export const pagarRecibo = (id, data) => axiosClient.patch(`${BASE}/recibos/${id}/pagar`, data).then((r) => r.data);

export const anularRecibo = (id, motivo) =>
  axiosClient.delete(`${BASE}/recibos/${id}`, { data: { motivo } }).then((r) => r.data);

// Adelantos: SÍ se descuentan del próximo sueldo.
export const listarAdelantos = (params) => axiosClient.get(`${BASE}/adelantos`, { params }).then((r) => r.data);

export const crearAdelanto = (data) => axiosClient.post(`${BASE}/adelantos`, data).then((r) => r.data);

// ---------- Sector 2: compras ----------
export const listarCompras = (params) => axiosClient.get(`${BASE}/compras`, { params }).then((r) => r.data);

export const crearCompra = (data) => axiosClient.post(`${BASE}/compras`, data).then((r) => r.data);

// ---------- Sector 3: préstamos ----------
// NO se descuentan del sueldo: se cobran por abonos.
export const listarPrestamos = (params) => axiosClient.get(`${BASE}/prestamos`, { params }).then((r) => r.data);

export const obtenerPrestamo = (id) => axiosClient.get(`${BASE}/prestamos/${id}`).then((r) => r.data);

export const crearPrestamo = (data) => axiosClient.post(`${BASE}/prestamos`, data).then((r) => r.data);

export const abonarPrestamo = (id, data) =>
  axiosClient.post(`${BASE}/prestamos/${id}/abonos`, data).then((r) => r.data);

export const anularPrestamo = (id, motivo) =>
  axiosClient.delete(`${BASE}/prestamos/${id}`, { data: { motivo } }).then((r) => r.data);

// ---------- Libro de caja ----------
export const verLibro = (params) => axiosClient.get(`${BASE}/caja`, { params }).then((r) => r.data);

export const crearMovimientoCaja = (data) => axiosClient.post(`${BASE}/caja`, data).then((r) => r.data);

export const anularMovimientoCaja = (id, motivo) =>
  axiosClient.delete(`${BASE}/caja/${id}`, { data: { motivo } }).then((r) => r.data);
