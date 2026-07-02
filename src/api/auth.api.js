import axiosClient from './axiosClient';

export const login = (email, password) =>
  axiosClient.post('/auth/login', { email, password }).then((res) => res.data);

export const registrar = (nombre, email, password, rol) =>
  axiosClient.post('/auth/registro', { nombre, email, password, rol }).then((res) => res.data);

export const obtenerPerfil = () => axiosClient.get('/auth/perfil').then((res) => res.data);
