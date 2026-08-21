import axiosClient from '../../api/axiosClient';

export const obtenerTasas = () => axiosClient.get('/tasas').then((res) => res.data);

export const actualizarTasas = (datos) => axiosClient.put('/tasas', datos).then((res) => res.data);
