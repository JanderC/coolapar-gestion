import axiosClient from './axiosClient';

const BASE = '/reportes';

// Ventas del período con su ganancia y su margen, producto por producto.
export const reporteVentas = (params) => axiosClient.get(`${BASE}/ventas`, { params }).then((r) => r.data);

// Cuánto cuesta producir un kilo de cada producto, según sus lotes.
export const reporteCostos = () => axiosClient.get(`${BASE}/costos`).then((r) => r.data);
