import axiosClient from './axiosClient';

export const listarComprasProveedores = (proveedor_id) =>
  axiosClient
    .get('/compras-proveedores', { params: proveedor_id ? { proveedor_id } : {} })
    .then((r) => r.data);

export const crearCompraProveedor = (data) =>
  axiosClient.post('/compras-proveedores', data).then((r) => r.data);
