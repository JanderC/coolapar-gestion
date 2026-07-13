import axiosClient from './axiosClient';

export const obtenerConfiguracion = () => axiosClient.get('/configuracion').then((r) => r.data);

export const actualizarMonedaSistema = (moneda) =>
  axiosClient.put('/configuracion/moneda', { moneda }).then((r) => r.data);
