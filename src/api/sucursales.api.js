import axiosClient from './axiosClient';

const BASE = '/sucursales';

// Devuelve la lista y, si ya está hecha la migración, los usuarios de cada una.
export const listarSucursales = (params) => axiosClient.get(BASE, { params }).then((r) => r.data);

export const obtenerSucursal = (id) => axiosClient.get(`${BASE}/${id}`).then((r) => r.data);

export const crearSucursal = (data) => axiosClient.post(BASE, data).then((r) => r.data);

export const actualizarSucursal = (id, data) => axiosClient.put(`${BASE}/${id}`, data).then((r) => r.data);

export const archivarSucursal = (id) => axiosClient.delete(`${BASE}/${id}`).then((r) => r.data);
