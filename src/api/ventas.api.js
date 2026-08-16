import axiosClient from './axiosClient';

const BASE = '/ventas';

// ---------- Planta (administrador) ----------

// Productos con existencia en cuarto frío, para armar la venta.
export const productosDisponibles = () => axiosClient.get(`${BASE}/disponibles`).then((r) => r.data);

// Devuelve { data: [...ventas], totales } — un usuario de sucursal recibe
// la versión recortada, sin precios ni kilos enviados.
export const listarVentas = (params) => axiosClient.get(BASE, { params }).then((r) => r.data);

export const obtenerVenta = (id) => axiosClient.get(`${BASE}/${id}`).then((r) => r.data);

export const crearVenta = (data) => axiosClient.post(BASE, data).then((r) => r.data);

export const anularVenta = (id, motivo) =>
  axiosClient.delete(`${BASE}/${id}`, { data: { motivo } }).then((r) => r.data);

// ---------- Despachos ----------

// Para la sucursal: lo que tiene por confirmar.
// Para el administrador: lo pendiente y lo que quedó en diferencia.
export const despachosPendientes = () => axiosClient.get(`${BASE}/despachos/pendientes`).then((r) => r.data);

// conteos: [{ item_id, kilos, piezas }]
export const confirmarRecepcion = (id, conteos) =>
  axiosClient.post(`${BASE}/${id}/recepcion`, { conteos }).then((r) => r.data);

// resolucion: 'acepta_enviado' | 'acepta_recibido' | 'merma_transito'
export const resolverDiferencia = (id, resolucion, nota) =>
  axiosClient.patch(`${BASE}/${id}/resolver`, { resolucion, nota }).then((r) => r.data);

// ---------- Sucursal ----------
export const inventarioSucursal = (params) =>
  axiosClient.get(`${BASE}/sucursal/inventario`, { params }).then((r) => r.data);

export const movimientosSucursal = (params) =>
  axiosClient.get(`${BASE}/sucursal/movimientos`, { params }).then((r) => r.data);

export const venderDesdeSucursal = (data) => axiosClient.post(`${BASE}/sucursal`, data).then((r) => r.data);
