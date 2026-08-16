import axiosClient from './axiosClient';

const BASE = '/usuarios';

// Devuelve { data: [...usuarios], roles: [{ valor, descripcion }] }
export const listarUsuarios = (params) => axiosClient.get(BASE, { params }).then((r) => r.data);

export const crearUsuario = (data) => axiosClient.post(BASE, data).then((r) => r.data);

export const actualizarUsuario = (id, data) => axiosClient.put(`${BASE}/${id}`, data).then((r) => r.data);

// Le asigna una contraseña nueva a otro usuario (la olvidó).
export const cambiarPasswordUsuario = (id, password) =>
  axiosClient.patch(`${BASE}/${id}/password`, { password }).then((r) => r.data);

export const desactivarUsuario = (id) => axiosClient.delete(`${BASE}/${id}`).then((r) => r.data);
